# Architectural Decisions Document

## UUID vs Serial
- **UUID**: Unique identifier that is universally unique and suitable for distributed systems.
- **Serial**: An integer that is auto-incremented in the database and is generally more human-readable and easier for debugging.

### Decision:
UUID is preferred for scalability and uniqueness across distributed systems.

## Enum vs Lookup
- **Enum**: A fixed set of values defined in the application code, tightly coupled with the logic.
- **Lookup**: Values are stored in a separate table, allowing for easier updates and changes without code modifications.

### Decision:
Lookup is favored for flexibility in managing values without code changes.

## Soft vs Hard Delete
- **Soft Delete**: Records are marked as deleted but remain in the database, allowing for recovery and historical tracking.
- **Hard Delete**: Records are permanently removed from the database.

### Decision:
Soft delete is chosen to preserve data integrity and allow for recovery of records when necessary.

## Audit Strategy
Audit logging will be implemented to track changes made to critical records, ensuring accountability and traceability. Changes will include who made the change, what the change was, and when it occurred.

## Saldo Calculation Approach
The saldo (balance) will be calculated in real-time based on transactions recorded in the system. It will ensure accuracy and reflect the most current state of the account at any given moment.

---
*Document created on 2026-02-27 17:24:32 UTC*