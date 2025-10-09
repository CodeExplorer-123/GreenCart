import express from "express";
import {
  placeOrderCOD,
  placeOrderStripeSession,
  getUserOrders,
  getAllOrders,
} from "../controllers/orderController.js";

import authUser from "../middlewares/authUser.js";
import authSeller from "../middlewares/authSeller.js";

const router = express.Router();

// Place Order using Cash on Delivery
router.post("/cod", authUser, placeOrderCOD);

// Place Order using Stripe (creates Checkout session)
router.post("/stripe", authUser, placeOrderStripeSession);

// Get Orders by User ID
router.get("/user", authUser, getUserOrders);

// Get All Orders (for admin or seller)
router.get("/seller", authSeller, getAllOrders);

export default router; 
