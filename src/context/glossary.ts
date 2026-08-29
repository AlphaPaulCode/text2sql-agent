/**
 * Business glossary: the "memory" component of the agent.
 *
 * This encodes how *this team* interprets ambiguous business language and
 * how answers should be formatted. It is the kind of institutional knowledge
 * a human analyst carries in their head; the baseline does not receive it.
 */
export const GLOSSARY = `
BUSINESS GLOSSARY AND REPORTING CONVENTIONS

Terminology:
- "best customer" = the customer with the highest lifetime spend, i.e. SUM(Invoice.Total) across all their invoices.
- "revenue" / "sales" = SUM(Invoice.Total) at invoice level, unless the question is about individual tracks/lines, then use InvoiceLine (UnitPrice * Quantity).
- "units sold" / "tracks sold" = SUM(InvoiceLine.Quantity).
- Track length is stored in Track.Milliseconds (1 minute = 60000 ms).

Data conventions:
- Invoice.InvoiceDate is stored as text 'YYYY-MM-DD HH:MM:SS'. Filter by year with strftime('%Y', InvoiceDate) = 'YYYY'.
- A missing value is NULL, never an empty string. Use IS NULL / IS NOT NULL.
- String matching is exact and case-sensitive unless the question implies otherwise.

Reporting conventions:
- When asked "who" about a person (customer or employee), return their full name as a single string: FirstName || ' ' || LastName, unless the question specifies otherwise.
- When asked "which X", return only the identifying column(s) the question asks for - no extra columns.
- Round monetary averages to 2 decimal places only when asked.
`.trim();

/** Few-shot examples showing the house style for SQL. */
export const EXAMPLES = `
EXAMPLES

Q: How many invoices were billed to Germany?
SQL: SELECT COUNT(*) FROM Invoice WHERE BillingCountry = 'Germany'

Q: Who bought the most individual tracks? (best = most units)
SQL: SELECT c.FirstName || ' ' || c.LastName FROM Customer c JOIN Invoice i ON i.CustomerId = c.CustomerId JOIN InvoiceLine il ON il.InvoiceId = i.InvoiceId GROUP BY c.CustomerId ORDER BY SUM(il.Quantity) DESC LIMIT 1

Q: How many tracks are in the 'Grunge' playlist?
SQL: SELECT COUNT(*) FROM PlaylistTrack pt JOIN Playlist p ON p.PlaylistId = pt.PlaylistId WHERE p.Name = 'Grunge'
`.trim();
