import uuid
import pytest
from unittest.mock import MagicMock, patch
from app.services.verification import VerificationService
from app.services.identity import IdentityService
from app.models.enums import ResultEnum, DenialReasonEnum, TicketStatusEnum
from app.models.log import Log
from app.adapters.mosip import StubMOSIPAdapter

def test_unhandled_exception_clears_ticket_info():
    """
    Test that an unhandled exception in the verification pipeline:
    1. Is caught by the catch-all Exception block.
    2. Sets the result to ERROR.
    3. CLEARS ticket_id and ticket_status_snapshot to satisfy the DB constraint
       check_ticket_absent_on_system_failure.
    4. Successfully writes the log row.
    """
    db = MagicMock()
    event_id = uuid.uuid4()
    assignment_id = uuid.uuid4()
    ticket_id = uuid.uuid4()
    
    # Mocking internal methods of VerificationService to reach the catch-all Exception block
    # We want to simulate a failure in _grant (Step 7) after _resolve_ticket (Step 6) has succeeded.
    
    with patch.object(VerificationService, "_resolve_gate_and_event") as mock_resolve_gate, \
         patch.object(VerificationService, "_verify_identity") as mock_verify_id, \
         patch.object(VerificationService, "_resolve_ticket") as mock_resolve_ticket, \
         patch.object(VerificationService, "_grant", side_effect=Exception("Simulated Failure")):
        
        def side_effect_resolve_gate(ctx):
            ctx.event_id = event_id
            ctx.assignment_id = assignment_id
            ctx.event_name_snapshot = "Test Event"
            ctx.gate_location_snapshot = "Test Gate Location"
            return ctx
            
        def side_effect_verify_id(ctx):
            ctx.uin = "1234567890123456"
            ctx.psut = "some-psut"
            ctx.link_hash = "some-hash"
            return ctx
            
        def side_effect_resolve_ticket(ctx):
            ctx.ticket_id = ticket_id
            ctx.ticket_status_snapshot = TicketStatusEnum.UNUSED.value
            return ctx
            
        mock_resolve_gate.side_effect = side_effect_resolve_gate
        mock_verify_id.side_effect = side_effect_verify_id
        mock_resolve_ticket.side_effect = side_effect_resolve_ticket
        
        service = VerificationService(db=db, identity=IdentityService(mosip=StubMOSIPAdapter()))
        
        # Entry point
        response = service.verify("{}", str(uuid.uuid4()))
        
        # Should return a safe deny
        assert response.result == "deny"
        assert response.reason == DenialReasonEnum.INTERNAL_SERVER_ERROR
        
        # Verify db interactions
        db.rollback.assert_called_once()
        db.commit.assert_called_once()
        
        # Verify the Log row added to db
        # It should be the first (and only) call to db.add in this scenario
        assert db.add.call_count == 1
        log_entry = db.add.call_args[0][0]
        assert isinstance(log_entry, Log)
        
        assert log_entry.result == ResultEnum.ERROR
        assert log_entry.denial_reason == DenialReasonEnum.INTERNAL_SERVER_ERROR
        
        # CRITICAL: ticket_id and snapshot must be None to satisfy database check constraint
        assert log_entry.ticket_id is None
        assert log_entry.ticket_status_snapshot is None
        
        # Other info should be preserved
        assert log_entry.event_id == event_id
        assert log_entry.event_name_snapshot == "Test Event"
        assert log_entry.gate_location_snapshot == "Test Gate Location"
