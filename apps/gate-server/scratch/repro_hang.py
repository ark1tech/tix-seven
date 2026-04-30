import os
import sys
import logging
import time

# Add the app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

# Mock settings if needed (RealMOSIPAdapter uses dynaconf which reads .env)
# Since we are running in the scratch folder, it should find the .env in the root or parent.

from app.adapters.mosip import RealMOSIPAdapter

# Setup logging to console to see what happens
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("repro_final")

def test_actual_initialization():
    logger.info("Triggering RealMOSIPAdapter initialization...")
    start = time.time()
    try:
        # This will call _make_authenticator, which is now monkey-patched
        adapter = RealMOSIPAdapter()
        duration = time.time() - start
        logger.info(f"Initialization finished in {duration:.4f}s")
        
        # Check if the authenticator was actually created
        if adapter._authenticator:
            logger.info("SUCCESS: Authenticator is ready.")
        else:
            logger.error("FAILURE: Authenticator is None.")
            
    except Exception as e:
        logger.exception(f"ERROR: Initialization failed: {e}")

if __name__ == "__main__":
    test_actual_initialization()
