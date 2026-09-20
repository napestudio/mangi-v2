export enum UserRole {
  SUPERADMIN = "SUPERADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE",
  WAITER = "WAITER",
}

export enum Module {
  CORE = "CORE",
  SALON = "SALON",
  RESERVATIONS = "RESERVATIONS",
  CASH = "CASH",
  INVENTORY = "INVENTORY",
  DELIVERY = "DELIVERY",
  FISCAL = "FISCAL",
  SUPPLIERS = "SUPPLIERS",
  ANALYTICS = "ANALYTICS",
}

export enum SubscriptionStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CANCELLED = "CANCELLED",
}

export enum OrderStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}

export enum OrderType {
  DINE_IN = "DINE_IN",
  TAKE_AWAY = "TAKE_AWAY",
  DELIVERY = "DELIVERY",
  COUNTER = "COUNTER",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
  PAYMENT_LINK = "PAYMENT_LINK",
  QR_CODE = "QR_CODE",
}

export enum PaymentMethodExtended {
  CASH = "CASH",
  CARD_DEBIT = "CARD_DEBIT",
  CARD_CREDIT = "CARD_CREDIT",
  TRANSFER = "TRANSFER",
  PAYMENT_LINK = "PAYMENT_LINK",
  QR_CODE = "QR_CODE",
  ACCOUNT = "ACCOUNT",
}

export enum ReservationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SEATED = "SEATED",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
  NO_SHOW = "NO_SHOW",
}

export enum PriceType {
  DINE_IN = "DINE_IN",
  TAKE_AWAY = "TAKE_AWAY",
  DELIVERY = "DELIVERY",
}

export enum TableShape {
  SQUARE = "SQUARE",
  RECTANGLE = "RECTANGLE",
  CIRCLE = "CIRCLE",
  WIDE = "WIDE",
}

export enum TableStatus {
  EMPTY = "EMPTY",
  OCCUPIED = "OCCUPIED",
  RESERVED = "RESERVED",
  CLEANING = "CLEANING",
  PAYING = "PAYING",
}

export enum UnitType {
  UNIT = "UNIT",
  WEIGHT = "WEIGHT",
  VOLUME = "VOLUME",
}

export enum WeightUnit {
  KILOGRAM = "KILOGRAM",
  GRAM = "GRAM",
  POUND = "POUND",
  OUNCE = "OUNCE",
}

export enum VolumeUnit {
  LITER = "LITER",
  MILLILITER = "MILLILITER",
  GALLON = "GALLON",
  FLUID_OUNCE = "FLUID_OUNCE",
}

export enum CashRegisterStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum CashMovementType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  SALE = "SALE",
  REFUND = "REFUND",
  CORRECTION = "CORRECTION",
}

export enum HomePageLinkType {
  MENU = "MENU",
  TIMESLOT = "TIMESLOT",
  RESERVATION = "RESERVATION",
  PEDIDOS = "PEDIDOS",
  CUSTOM = "CUSTOM",
}

export enum ProductTag {
  SPICY = "SPICY",
  VEGAN = "VEGAN",
  VEGETARIAN = "VEGETARIAN",
  GLUTEN_FREE = "GLUTEN_FREE",
  DAIRY_FREE = "DAIRY_FREE",
  NUT_FREE = "NUT_FREE",
  NEW = "NEW",
  POPULAR = "POPULAR",
}

export enum PermissionGrant {
  VIEW_STATISTICS = "VIEW_STATISTICS",
  VIEW_INVOICES = "VIEW_INVOICES",
  VIEW_CASH_REGISTERS = "VIEW_CASH_REGISTERS",
  VIEW_STOCK = "VIEW_STOCK",
  MANAGE_MENU = "MANAGE_MENU",
  MANAGE_PRODUCTS = "MANAGE_PRODUCTS",
  MANAGE_CONFIG = "MANAGE_CONFIG",
}

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

export enum RestaurantType {
  RESTAURANT = "RESTAURANT",
  CAFETERIA = "CAFETERIA",
  BAR = "BAR",
  FAST_FOOD = "FAST_FOOD",
  PIZZERIA = "PIZZERIA",
  PARRILLA = "PARRILLA",
  SUSHI = "SUSHI",
  BAKERY = "BAKERY",
  FOOD_TRUCK = "FOOD_TRUCK",
  OTHER = "OTHER",
}

export enum InvoiceStatus {
  PENDING = "PENDING",
  EMITTED = "EMITTED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum PrinterStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  ERROR = "ERROR",
}

export enum PrintJobStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  CANCELED = "CANCELED",
}

export enum PrintMode {
  STATION_ITEMS = "STATION_ITEMS",
  FULL_ORDER = "FULL_ORDER",
  BOTH = "BOTH",
}

export enum PrinterConnectionType {
  NETWORK = "NETWORK",
  USB = "USB",
}

export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  ORDERED = "ORDERED",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED",
}
