# Data Model Draft — Carsystem i R-M

This is an early planning draft. Final schema should be reviewed before implementation.

## 1. Core Entities

### users

- id
- email
- password_hash or auth_provider_id
- role: admin | sales_rep | customer | partner_store
- name
- phone
- status: pending | active | disabled
- created_at
- updated_at

### customers

- id
- user_id
- company_name
- pib
- no_pib boolean
- customer_type: store | service | workshop | individual | other
- city
- region_id
- assigned_sales_rep_id
- default_discount_percent
- status
- created_at
- updated_at

### sales_reps

- id
- user_id
- name
- phone
- email
- active
- created_at
- updated_at

### regions

- id
- name
- slug
- assigned_sales_rep_id
- created_at
- updated_at

### partner_stores

- id
- name
- slug
- address
- city
- region_id
- phone
- email
- working_hours
- latitude
- longitude
- description
- active
- created_at
- updated_at

### brands

- id
- name
- slug
- description
- logo_url
- color_hint
- seo_title
- seo_description
- active

### categories

- id
- parent_id
- name
- slug
- description
- seo_title
- seo_description
- active

### products

- id
- sku
- name
- slug
- brand_id
- category_id
- description
- base_price
- wholesale_price
- purchase_price
- unit
- package_size
- image_url
- technical_sheet_url
- safety_sheet_url
- active
- created_at
- updated_at

### product_variants

- id
- product_id
- sku
- name
- package_size
- base_price
- active

## 2. Discount System

### discount_rules

- id
- customer_id
- sales_rep_id
- scope_type: brand | category | product | product_group | global
- brand_id nullable
- category_id nullable
- product_id nullable
- product_group_id nullable
- discount_percent
- fixed_price nullable
- valid_from nullable
- valid_to nullable
- active
- created_at
- updated_at

### product_groups

- id
- name
- slug
- description

### product_group_items

- id
- product_group_id
- product_id

## 3. Inquiries

### inquiries

- id
- user_id nullable
- customer_id nullable
- name
- email
- phone
- city
- region_id nullable
- nearest_partner_store_id nullable
- assigned_sales_rep_id nullable
- message
- status: new | contacted | resolved | archived
- created_at
- updated_at

### inquiry_items

- id
- inquiry_id
- product_id
- variant_id nullable
- quantity
- note

## 4. Imports

### import_batches

- id
- type: products | discounts | partners
- filename
- status: uploaded | validating | completed | failed
- total_rows
- success_rows
- error_rows
- created_by_user_id
- created_at

### import_errors

- id
- import_batch_id
- row_number
- field
- message
- raw_row_json

## 5. Notifications

### notifications

- id
- user_id
- type
- title
- body
- read_at nullable
- related_entity_type
- related_entity_id
- created_at

## 6. Price Calculation Draft

Inputs:

- product base price,
- logged-in customer,
- customer default discount,
- matching discount rules.

Suggested priority:

1. active fixed price for exact customer + product,
2. active percent discount for exact customer + product,
3. active rule for product group,
4. active rule for category,
5. active rule for brand,
6. customer default discount,
7. base price.

Open question: whether rules combine or highest priority single rule wins. Recommendation: use single highest-priority rule to avoid confusion unless business requires stacking.

## 7. Access Control Draft

### Admin

- can read/write all data.

### Sales Rep

- can read assigned customers,
- can read new signups in assigned region,
- can edit discounts for assigned customers,
- cannot edit other reps' customers unless transferred/allowed,
- cannot edit global products unless later approved.

### Customer

- can read public catalog,
- can read own private prices,
- can submit inquiries,
- can view own inquiry history.

### Logged-out Visitor

- can read public pages,
- can read public product data without private prices,
- can send inquiry,
- can use partner locator.
