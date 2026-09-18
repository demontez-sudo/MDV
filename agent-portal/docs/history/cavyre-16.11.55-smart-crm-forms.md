# CAVYRE 16.11.55 — Smart CRM Forms

Built on 16.11.54 Vera Advanced Operating Intelligence.

## Change
Replaces the legacy minimum Add Company / Add Contact creators with relationship-intelligent forms while preserving the existing `/api/agent/crm/v9` persistence authority.

### Company
Identity/type/status/tier, relationship strength, priority, follow-up cadence, owner, source, markets, website/email/phone/social, specialties, address, internal intelligence notes, and Vera web research entry.

### Contact
Canonical person identity, role/type/status/market, primary company, multiple company/client/agency links with relationship role per link, relationship context, email/phone/WhatsApp/preferred contact/social, strength/priority/follow-up cadence/owner/source/tags, notes, and Vera recent-work research entry.

### Relationship rule
One person remains one contact record. `linked_companies` is sent to CRM v9 so the existing `contact_company_links` authority connects the same contact to multiple organizations instead of duplicating the person.

### Compatibility
Both legacy `VEUX_V133.newCompany/newContact` and current `CavyreRelationships.openCompany/openContact` entry points are routed to the smart forms. Root and `/admin` shells load the same 16.11.55 assets.
