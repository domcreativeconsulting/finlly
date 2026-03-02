# Database Schema Documentation

## Legacy Schema Mapping

This document describes the mapping of the legacy database schema used in the project.

### Tables Overview

1. **Users**: Stores user information including credentials and profile details.
   - **user_id** (INT, Primary Key): Unique identifier for each user.
   - **username** (VARCHAR): User's login name.
   - **email** (VARCHAR): User's email address.
   - **created_at** (DATETIME): Timestamp when the user account was created.

2. **Orders**: Contains details regarding purchases made by users.
   - **order_id** (INT, Primary Key): Unique identifier for each order.
   - **user_id** (INT, Foreign Key): Reference to the user who placed the order.
   - **order_date** (DATETIME): The date when the order was placed.
   - **total_amount** (DECIMAL): Total amount for the order.

3. **Products**: Holds information on products available for ordering.
   - **product_id** (INT, Primary Key): Unique identifier for each product.
   - **product_name** (VARCHAR): Name of the product.
   - **product_price** (DECIMAL): Price of the product.
   - **in_stock** (BOOLEAN): Availability status of the product.

### Relationships
- **Users to Orders**: One-to-many (a user can have multiple orders).
- **Orders to Products**: Many-to-many (an order can contain multiple products, and a product can be part of multiple orders).

### Indexes
- Users table has an index on `email` to speed up search queries.
- Orders table has indexes on `user_id` and `order_date` to optimize retrieval of orders based on user and date.

### Notes
- Ensure indexes are maintained to optimize query performance.
- Consider migration paths for updating legacy schema to future enhancements.