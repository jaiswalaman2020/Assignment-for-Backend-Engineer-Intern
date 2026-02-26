# Bitespeed Identity Reconciliation Backend

A Node.js/TypeScript backend service that implements identity reconciliation for FluxKart.com. This service tracks and consolidates customer contact information across multiple purchases.

## Overview

The service provides an `/identify` endpoint that:

- Receives email and/or phone number from customer orders
- Links different contact entries to the same customer
- Manages primary and secondary contact relationships
- Handles merging of contact records

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (or any SQL database supported by Prisma)
- **ORM**: Prisma

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL (or your preferred SQL database)

## Installation

1. Clone the repository

```bash
git clone <repository-url>
cd bitespeed-identity-reconciliation
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
# Edit .env and add your database URL
```

4. Set up the database schema

```bash
# For managed databases (Render, Neon, etc.)
npm run prisma:migrate

# For local dev databases
npm run prisma:migrate:dev
```

## Running the Application

### Development mode

```bash
npm run dev
```

### Production mode

```bash
npm run build
npm start
```

## Database Schema

The `Contact` model stores customer contact information:

```prisma
model Contact {
  id             Int      @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?               // ID of the primary contact this is linked to
  linkPrecedence String             // "primary" or "secondary"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?
}
```

## API Endpoints

### POST /identify

Identifies a customer and consolidates their contact information.

**Request Body:**

```json
{
  "email": "customer@example.com",
  "phoneNumber": "1234567890"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["customer@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": [2, 3]
  }
}
```

**Notes:**

- At least one of `email` or `phoneNumber` must be provided
- Email and phone can be either string or null
- The response consolidates all contact information linked to the primary contact
- Primary contact email/phone appear first in the arrays

### GET /health

Health check endpoint to verify the service is running.

## How It Works

### Scenario 1: New Customer

If no existing contact matches the email or phone number:

- A new `Contact` record is created with `linkPrecedence = "primary"`
- Empty arrays for secondary contacts and additional emails/phones

### Scenario 2: Existing Customer (Partial Match)

If email or phone matches an existing contact:

- **If all information already exists**: Returns existing consolidated data
- **If new email/phone is provided**: Creates a new `Contact` with `linkPrecedence = "secondary"` linked to the primary

### Scenario 3: Merging Contacts

If the request matches contacts linked to different primary contacts:

- The oldest (earliest `createdAt`) primary contact becomes the primary
- All other primary contacts become secondary, linked to the oldest primary
- All contact information is consolidated and returned

## Deployment

### Render.com Deployment (Free Tier)

1. Push your repository to GitHub
2. Create a Render account and connect your GitHub repository
3. Create a new PostgreSQL database on Render
4. Create a new Web Service on Render:
   - Connect your GitHub repo
   - Set the build command: `npm install && npm run build`
   - Set the start command: `npm start`
   - Add environment variables:
     - `DATABASE_URL`: Your PostgreSQL connection string from Render
     - `NODE_ENV`: `production`
     - `PORT`: `3000`
5. Deploy and wait for completion

Your API will be available at: `https://<service-name>.onrender.com/identify`

### Vercel Deployment (Alternative)

Vercel also offers PostgreSQL databases. You can set up similarly but may need to use a serverless function approach.

## Example Usage

### Request 1: New customer

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lorraine@hillvalley.edu",
    "phoneNumber": "123456"
  }'
```

### Request 2: Same phone, different email

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mcfly@hillvalley.edu",
    "phoneNumber": "123456"
  }'
```

Both requests will return consolidated data with both emails linked to the same customer.

## Project Structure

```
.
├── src/
│   └── index.ts           # Main application logic
├── prisma/
│   └── schema.prisma      # Database schema
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env.example           # Environment variables template
└── README.md              # This file
```

## Development Notes

### Making Database Changes

If you modify `prisma/schema.prisma`:

```bash
npm run prisma:migrate
```

### Viewing Database

To view and manage data in the database UI:

```bash
npm run prisma:studio
```

## Error Handling

- `400 Bad Request`: Missing both email and phoneNumber
- `500 Internal Server Error`: Database or server error

## Future Enhancements

- Add input validation (email format, phone number format)
- Add rate limiting
- Add authentication/authorization
- Add logging and monitoring
- Add caching for performance optimization
- Add soft delete support with `deletedAt` field

## License

MIT

## Contact

For questions or issues, please submit them to the repository's issue tracker.
