import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

interface ContactResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

/**
 * Get all contacts linked to a primary contact (including the primary itself)
 */
async function getLinkedContacts(primaryId: number): Promise<any[]> {
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryId }, { linkedId: primaryId }],
    },
    orderBy: { createdAt: "asc" },
  });
  return contacts;
}

/**
 * Find the primary contact ID for a given contact
 */
async function getPrimaryContactId(contactId: number): Promise<number> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) return contactId;
  if (contact.linkedId === null) return contactId;

  return getPrimaryContactId(contact.linkedId);
}

/**
 * Consolidate contact information from all linked contacts
 */
async function consolidateContacts(
  primaryContactId: number,
): Promise<ContactResponse> {
  const contacts = await getLinkedContacts(primaryContactId);

  const emailsSet = new Set<string>();
  const phoneNumbersSet = new Set<string>();
  const secondaryContactIds: number[] = [];

  for (const contact of contacts) {
    if (contact.email) emailsSet.add(contact.email);
    if (contact.phoneNumber) phoneNumbersSet.add(contact.phoneNumber);

    if (contact.id !== primaryContactId) {
      secondaryContactIds.push(contact.id);
    }
  }

  // Primary contact's email and phone should come first
  const primaryContact = contacts.find((c) => c.id === primaryContactId);
  const emails: string[] = [];
  const phoneNumbers: string[] = [];

  if (primaryContact?.email) emails.push(primaryContact.email);
  emailsSet.forEach((email) => {
    if (email !== primaryContact?.email) emails.push(email);
  });

  if (primaryContact?.phoneNumber)
    phoneNumbers.push(primaryContact.phoneNumber);
  phoneNumbersSet.forEach((phone) => {
    if (phone !== primaryContact?.phoneNumber) phoneNumbers.push(phone);
  });

  return {
    contact: {
      primaryContactId,
      emails: Array.from(emails),
      phoneNumbers: Array.from(phoneNumbers),
      secondaryContactIds,
    },
  };
}

/**
 * POST /identify endpoint
 */
app.post("/identify", async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Validate input - at least one of email or phoneNumber must be provided
    if (!email && !phoneNumber) {
      return res.status(400).json({
        error: "Either email or phoneNumber must be provided",
      });
    }

    // Find all contacts that match the email or phoneNumber
    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phoneNumber ? [{ phoneNumber }] : []),
        ],
      },
    });

    if (matchingContacts.length === 0) {
      // No existing contact found - create a new primary contact
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: "primary",
        },
      });

      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // Get all primary contact IDs from matching contacts
    const primaryIds = new Set<number>();
    for (const contact of matchingContacts) {
      const primaryId = await getPrimaryContactId(contact.id);
      primaryIds.add(primaryId);
    }

    // Sort primary IDs by creation date to find the oldest (most primary)
    const primaryIdArray = Array.from(primaryIds);
    const primaryContacts = await prisma.contact.findMany({
      where: { id: { in: primaryIdArray } },
      orderBy: { createdAt: "asc" },
    });

    const oldestPrimaryId = primaryContacts[0].id;

    // If there are multiple primary contacts, make the newer ones secondary to the oldest
    for (let i = 1; i < primaryContacts.length; i++) {
      await prisma.contact.update({
        where: { id: primaryContacts[i].id },
        data: {
          linkedId: oldestPrimaryId,
          linkPrecedence: "secondary",
        },
      });
    }

    // Check if we need to create a new secondary contact
    const existingEmails = new Set<string>();
    const existingPhoneNumbers = new Set<string>();

    const allLinkedContacts = await getLinkedContacts(oldestPrimaryId);
    for (const contact of allLinkedContacts) {
      if (contact.email) existingEmails.add(contact.email);
      if (contact.phoneNumber) existingPhoneNumbers.add(contact.phoneNumber);
    }

    const needsNewContact =
      (email && !existingEmails.has(email)) ||
      (phoneNumber && !existingPhoneNumbers.has(phoneNumber));

    if (needsNewContact) {
      await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkedId: oldestPrimaryId,
          linkPrecedence: "secondary",
        },
      });
    }

    // Return consolidated contact
    const result = await consolidateContacts(oldestPrimaryId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in /identify endpoint:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
