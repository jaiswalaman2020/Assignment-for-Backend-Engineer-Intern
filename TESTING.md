/\*\*

- Test cases for the /identify endpoint
- These demonstrate the expected behavior of the identity reconciliation service
  \*/

// Test Case 1: Brand new customer
// Request:
const test1Request = {
email: "priya.sharma@example.com",
phoneNumber: "9876543210",
};

// Expected Response:
const test1Response = {
contact: {
primaryContactId: 1,
emails: ["priya.sharma@example.com"],
phoneNumbers: ["9876543210"],
secondaryContactIds: [],
},
};

// Database State After:
// {
// id: 1,
// phoneNumber: "9876543210",
// email: "priya.sharma@example.com",
// linkedId: null,
// linkPrecedence: "primary",
// createdAt: "2023-04-01T00:00:00.374Z",
// updatedAt: "2023-04-01T00:00:00.374Z",
// deletedAt: null
// }

---

// Test Case 2: Same customer, different email, same phone
// Request:
const test2Request = {
email: "arjun.patel@example.com",
phoneNumber: "9876543210",
};

// Expected Response:
const test2Response = {
contact: {
primaryContactId: 1,
emails: ["priya.sharma@example.com", "arjun.patel@example.com"],
phoneNumbers: ["9876543210"],
secondaryContactIds: [23],
},
};

// Database State After:
// {
// id: 1,
// phoneNumber: "9876543210",
// email: "priya.sharma@example.com",
// linkedId: null,
// linkPrecedence: "primary",
// ...
// },
// {
// id: 23,
// phoneNumber: "9876543210",
// email: "arjun.patel@example.com",
// linkedId: 1,
// linkPrecedence: "secondary",
// ...
// }

---

// Test Case 3: Merging two primary contacts
// Initial Database State:
// Contact 1 (primary, created 2023-04-11):
// {
// id: 11,
// phoneNumber: "9123456789",
// email: "neha.gupta@example.com",
// linkedId: null,
// linkPrecedence: "primary"
// }

// Contact 2 (primary, created 2023-04-21):
// {
// id: 27,
// phoneNumber: "8765432109",
// email: "vijay.kumar@example.com",
// linkedId: null,
// linkPrecedence: "primary"
// }

// Request with email matching first and phone matching second:
const test3Request = {
email: "neha.gupta@example.com",
phoneNumber: "8765432109",
};

// Expected Response (Contact 11 is older, so it becomes primary):
const test3Response = {
contact: {
primaryContactId: 11,
emails: ["neha.gupta@example.com", "vijay.kumar@example.com"],
phoneNumbers: ["9123456789", "8765432109"],
secondaryContactIds: [27],
},
};

// Database State After:
// Contact 1 (unchanged):
// {
// id: 11,
// phoneNumber: "9123456789",
// email: "neha.gupta@example.com",
// linkedId: null,
// linkPrecedence: "primary"
// }

// Contact 2 (now secondary, linked to 11):
// {
// id: 27,
// phoneNumber: "8765432109",
// email: "vijay.kumar@example.com",
// linkedId: 11,
// linkPrecedence: "secondary"
// }

---

// Test Case 4: Request with only phone number
const test4Request = {
phoneNumber: "9876543210",
};

// Test Case 5: Request with only email
const test5Request = {
email: "priya.sharma@example.com",
};

// Test Case 6: Neither email nor phone (should return 400)
const test6Request = {};
// Expected: 400 Bad Request

---

// Running Tests with curl:

// Test 1:
// curl -X POST http://localhost:3000/identify \
// -H "Content-Type: application/json" \
// -d '{"email":"priya.sharma@example.com","phoneNumber":"9876543210"}' \
// | jq

// Test 2:
// curl -X POST http://localhost:3000/identify \
// -H "Content-Type: application/json" \
// -d '{"email":"arjun.patel@example.com","phoneNumber":"9876543210"}' \
// | jq

// Test 3:
// curl -X POST http://localhost:3000/identify \
// -H "Content-Type: application/json" \
// -d '{"email":"neha.gupta@example.com","phoneNumber":"8765432109"}' \
// | jq

// Health check:
// curl http://localhost:3000/health | jq
