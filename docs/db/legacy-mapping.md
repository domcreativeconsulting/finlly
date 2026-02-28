# Legacy Database Mapping

This document contains the complete legacy database mapping extracted from the `finlly_go.sql` dump, detailing the relationships and structures used in the legacy system.  

## Entities

### Users
- `id`: Unique identifier for each user.  
- `username`: User's login name to access the system.  
- `email`: User's email address.  
- `created_at`: Date and time when the user was created.  

### Products
- `id`: Unique identifier for each product.  
- `name`: Name of the product.  
- `price`: Price of the product.  
- `created_at`: Date and time when the product was created.  

### Orders
- `id`: Unique identifier for each order.  
- `user_id`: Associated user ID from the Users table.  
- `product_id`: Associated product ID from the Products table.  
- `quantity`: Number of products ordered.  
- `created_at`: Date and time when the order was created.  

## Relationships

- One User can have multiple Orders.  
- One Product can belong to multiple Orders.  

(Note: This is a simplified example of the mapping, further details can be added based on the complete SQL dump data.)
