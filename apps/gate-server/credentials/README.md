# MOSIP partner credentials (not in git)

`RealMOSIPAdapter` and the `mosip-auth-sdk` need these **exact filenames** in this directory (`apps/gate-server/credentials/`):

| File | Role |
|------|------|
| `pdec_ida_partner.pem` | IDA partner encryption certificate |
| `keystore.p12` | PKCS#12 keystore (decrypt / encrypt) |
| `keystore-signed.p12` | PKCS#12 keystore (RS256 signing) |

Get them from your team’s MOSIP / PDEC partner pack (they are the same files the testbed example configs reference). The gate server does not use a “stub” MOSIP at runtime: if these files are absent, the process will error when it first loads the real adapter (e.g. on ticket issue or verify).

Environment variables in `../.env` must match the partner / testbed (`MOSIP_PARTNER_ID`, `MOSIP_PARTNER_APIKEY`, `MOSIP_PARTNER_MISP_LK`, `MOSIP_KEYSTORE_PASSWORD`, and IDA URLs) **and** network access to the IDA host (e.g. VPN) where required.
