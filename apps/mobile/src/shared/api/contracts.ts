import type { components } from "./schema";

type Schemas = components["schemas"];

export type UserPublic = Schemas["UserPublic"];
export type MobileTokenPair = Schemas["MobileTokenPair"];
export type AccessScopes = Schemas["AccessScopesRead"];
export type Building = Schemas["BuildingRead"];
export type Apartment = Schemas["ApartmentRead"];
export type Account = Schemas["AccountRead"];
export type InvoiceItem = Schemas["InvoiceItemRead"];

export type Invoice = Schemas["InvoiceRead"];
export type Payment = Schemas["PaymentRead"];
export type InvoiceStatus = Invoice["status"];

export type Ticket = Schemas["TicketRead"];
export type TicketStatus = Ticket["status"];
export type TicketPage = Schemas["TicketPage"];
export type TicketHistory = Schemas["TicketHistoryRead"];
export type TicketAttachment = Schemas["TicketAttachmentRead"];
export type TicketCreate = Schemas["TicketCreate"];
export type TicketPriority = TicketCreate["priority"];
