# Evident — Service Level Agreement (SLA) Summary

**Version:** 1.0 | **Date:** March 2026

---

## 1. Scope

This SLA applies to Evident's enterprise customers on Priority Support plans (add-on for Cloud and Custom Storage tiers, included with Private Cloud and On-Premise tiers).

---

## 2. Uptime Commitment

| Tier | Uptime Target | Monthly Downtime Allowance |
|------|--------------|---------------------------|
| Evident Cloud | 99.5% | ~2.2 hours |
| Custom Storage | 99.5% | ~2.2 hours |
| Private Cloud | 99.9% | ~43 minutes |
| On-Premise | N/A (client-managed) | Client responsibility |

**Exclusions:** Scheduled maintenance (notified 48 hours in advance), force majeure, client-side network issues, third-party service outages (OpenAI, cloud providers).

---

## 3. Support Response Times

| Severity | Description | Response Time | Resolution Target |
|----------|-------------|---------------|-------------------|
| **Critical** | Platform completely unavailable, data loss risk | 1 hour | 4 hours |
| **High** | Major feature unavailable, significant impact on users | 4 hours | 1 business day |
| **Medium** | Feature partially impaired, workaround available | 8 business hours | 3 business days |
| **Low** | Minor issue, cosmetic, feature request | 2 business days | Best effort |

**Support hours:** Monday–Friday, 9:00–18:00 GMT (standard). 24/7 for Critical issues on Private Cloud and On-Premise tiers.

---

## 4. Support Channels

| Channel | Availability |
|---------|-------------|
| Email (support@evident.ai) | All tiers |
| In-app feedback system | All tiers |
| Dedicated account contact | Private Cloud, On-Premise |
| Phone/video call | Critical issues (Priority Support) |

---

## 5. Maintenance Windows

- **Scheduled maintenance:** Weekends, 02:00–06:00 GMT, notified 48 hours in advance
- **Emergency maintenance:** As needed with best-effort advance notice
- **Updates:** Zero-downtime deployments for Cloud and Custom Storage tiers

---

## 6. Service Credits

If uptime falls below the committed target in any calendar month:

| Uptime | Service Credit |
|--------|---------------|
| 99.0% – 99.5% | 10% of monthly fee |
| 95.0% – 99.0% | 25% of monthly fee |
| Below 95.0% | 50% of monthly fee |

Credits are applied to the following month's invoice. Credits must be requested within 30 days of the incident.

---

## 7. Data Backup & Recovery

| Item | Standard |
|------|----------|
| Backup frequency | Daily (automated) |
| Backup retention | 30 days |
| Recovery Point Objective (RPO) | 24 hours |
| Recovery Time Objective (RTO) | 4 hours (Cloud), 8 hours (Private Cloud) |
| On-Premise | Client-managed (guidance provided) |

---

## 8. Incident Communication

- **Status page:** Real-time platform status available to all customers
- **Incident notifications:** Email alerts for Critical and High severity incidents
- **Post-incident reports:** Root cause analysis provided within 5 business days for Critical incidents
- **Scheduled maintenance notifications:** Minimum 48 hours advance notice via email

---

## 9. Escalation Path

| Level | Contact | Timeframe |
|-------|---------|-----------|
| Level 1 | Support team | Initial response |
| Level 2 | Engineering lead | After 2 hours (Critical) or 1 business day (High) |
| Level 3 | CTO / Founder | After 4 hours (Critical) or 2 business days (High) |

---

*This is a summary document. Full SLA terms are included in the enterprise agreement. Contact enterprise@evident.ai for the complete agreement.*
