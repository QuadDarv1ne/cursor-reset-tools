# 🔒 Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.8.x   | :white_check_mark: |
| 2.7.x   | :x:                |
| < 2.7   | :x:                |

## Reporting a Vulnerability

We take the security of Cursor Reset Tools seriously. If you believe you've found a security vulnerability, please follow these guidelines:

### How to Report

1. **DO NOT** create a public GitHub issue for the vulnerability
2. Send an email to **security@sazumi.com** (if available) or create a **private** vulnerability report in GitHub Issues
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We'll confirm receipt of your report within **48 hours**
- **Initial Response**: We'll provide an initial assessment within **5 business days**
- **Resolution Timeline**: We aim to resolve critical issues within **14 days**

### Security Best Practices Implemented

#### Input Validation
- All API endpoints validate input parameters
- SQL injection prevention via parameterized queries
- XSS protection with HTML encoding in EJS templates

#### Network Security
- CORS headers configured
- Rate limiting on API endpoints
- Helmet.js for HTTP security headers
- Content Security Policy (CSP) support

#### Data Protection
- `.env` file for sensitive configuration (not tracked in git)
- Secure handling of machine IDs and tokens
- No sensitive data in logs

#### Dependencies
- Regular `npm audit` checks
- Automated dependency updates via Dependabot
- Pre-commit hooks for code quality

### Known Limitations

⚠️ **Important**: This tool requires administrator/root privileges to function. Ensure you trust the source before running.

### Security Checklist for Users

- [ ] Download from official GitHub repository only
- [ ] Verify commit signatures (when available)
- [ ] Review code changes before updating
- [ ] Keep dependencies up to date
- [ ] Run `npm audit` regularly
- [ ] Use in isolated environment when testing

### Bug Bounty Program

Currently, we do not have a formal bug bounty program. However, we greatly appreciate responsible disclosure and will acknowledge contributors in our security advisories (with permission).

---

**Last Updated:** March 26, 2026

**Contact:** For security concerns, please use the reporting process above.
