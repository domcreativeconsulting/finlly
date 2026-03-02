# Legacy Schema Mapping

## Users
### Table: users
- **Purpose**: This table stores user information, including authentication details and personal data.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `username` (varchar, NOT NULL)
  - `email` (varchar, NOT NULL)
- **Primary Key**: `id`
- **Foreign Keys**: None
- **Indexes/Unique**: Unique index on `username`
- **Expected Volume**: 100,000 users
- **Main Operations**: Inserting new users, updating user details, deleting inactive accounts.

### Related Code Files
- `users.php`

## Billing
### Table: billing
- **Purpose**: This table handles billing transactions, linking to associated user accounts.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `user_id` (int, NOT NULL)
  - `amount` (decimal, NOT NULL)
- **Primary Key**: `id`
- **Foreign Keys**: `user_id` references `users.id`
- **Indexes/Unique**: Unique constraint on `user_id`
- **Expected Volume**: 50,000 transactions per year
- **Main Operations**: Recording transactions, processing refunds.

### Related Code Files
- `billing.php`

## Financial
### Table: financial
- **Purpose**: This table keeps track of user financial records.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `user_id` (int, NOT NULL)
  - `income` (decimal, NULL)
  - `expenses` (decimal, NULL)
- **Primary Key**: `id`
- **Foreign Keys**: `user_id` references `users.id`
- **Indexes/Unique**: None
- **Expected Volume**: 30,000 records
- **Main Operations**: Updating income and expenses, generating financial reports.

### Related Code Files
- `financial.php`

## Investments
### Table: investments
- **Purpose**: This table stores information about user investments.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `user_id` (int, NOT NULL)
  - `investment_type` (varchar, NOT NULL)
  - `amount` (decimal, NOT NULL)
- **Primary Key**: `id`
- **Foreign Keys**: `user_id` references `users.id`
- **Indexes/Unique**: None
- **Expected Volume**: 20,000 investments
- **Main Operations**: Recording new investments, tracking investment performance.

### Related Code Files
- `investments.php`

## Goals
### Table: goals
- **Purpose**: This table manages user financial goals.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `user_id` (int, NOT NULL)
  - `goal_name` (varchar, NOT NULL)
  - `goal_amount` (decimal, NULL)
- **Primary Key**: `id`
- **Foreign Keys**: `user_id` references `users.id`
- **Indexes/Unique**: None
- **Expected Volume**: 10,000 goals
- **Main Operations**: Creating, updating, deleting goals.

### Related Code Files
- `goals.php`

## Attachments
### Table: attachments
- **Purpose**: This table allows users to upload documents related to their financial activities.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `user_id` (int, NOT NULL)
  - `file_path` (varchar, NOT NULL)
- **Primary Key**: `id`
- **Foreign Keys**: `user_id` references `users.id`
- **Indexes/Unique**: None
- **Expected Volume**: 15,000 attachments
- **Main Operations**: Uploading and managing attachments.

### Related Code Files
- `attachments.php`

## WhatsApp
### Table: whatsapp
- **Purpose**: This table records user interactions via WhatsApp.
- **Main Columns**:
  - `id` (int, NOT NULL, AUTO_INCREMENT)
  - `user_id` (int, NOT NULL)
  - `message` (text, NOT NULL)
  - `timestamp` (datetime, NOT NULL)
- **Primary Key**: `id`
- **Foreign Keys**: `user_id` references `users.id`
- **Indexes/Unique**: None
- **Expected Volume**: 100,000 messages
- **Main Operations**: Storing messages, retrieving conversation history.

### Related Code Files
- `whatsapp.php`

## Other
### Table: other
- **Purpose**: (Provide purpose)
- **Main Columns**:
  - (List columns)
- **Primary Key**: (Specify key)
- **Foreign Keys**: (Specify keys)
- **Indexes/Unique**: (Specify fields)
- **Expected Volume**: (Provide volume)
- **Main Operations**: (List operations)

### Related Code Files
- `other.php`