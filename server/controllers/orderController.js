import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Stripe from "stripe";
import User from "../models/User.js";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Place Order (Cash On Delivery)

export const placeOrderCOD = async (req, res) => {
  try {
    const { userId, items, address } = req.body;

    console.log("Received COD order:", { userId, items, address });

    if (!address || items.length === 0) {
      console.warn("Invalid COD order data");
      return res
        .status(400)
        .json({ success: false, message: "Invalid order data" });
    }

    let amount = await items.reduce(async (acc, item) => {
      const product = await Product.findById(item.product);
      if (!product) throw new Error("Product not found: " + item.product);
      return (await acc) + product.offerPrice * item.quantity;
    }, 0);

    // Add 2% tax

    amount += Math.floor(amount * 0.02);
    console.log("Calculated COD order amount (with tax):", amount);

    await Order.create({
      userId,
      items,
      amount,
      address,
      paymentType: "COD",
      isPaid: false,
    });

    console.log("COD order created successfully.");
    res.json({ success: true, message: "Order placed successfully" });
  } catch (error) {
    console.error("Error in placeOrderCOD:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Place Order with Stripe Checkout

export const placeOrderStripeSession = async (req, res) => {
  try {
    const { userId, items, address } = req.body;
    const origin = req.headers.origin;

    console.log("Received Stripe session request:", { userId, items, address });

    if (!items.length || !address) {
      console.warn("Invalid online order data");
      return res
        .status(400)
        .json({ success: false, message: "Invalid order data" });
    }

    let amount = 0;
    const productData = [];

    for (let item of items) {
      const product = await Product.findById(item.product);
      if (!product) throw new Error("Product not found: " + item.product);
      amount += product.offerPrice * item.quantity;
      productData.push({
        name: product.name,
        price: product.offerPrice,
        quantity: item.quantity,
      });
    }

    // Add tax

    amount += Math.floor(amount * 0.02);
    console.log("Total Stripe order amount (with tax):", amount);

    // Create order in DB
    const order = await Order.create({
      userId,
      items,
      amount,
      address,
      paymentType: "Online",
      isPaid: true,
    });

    // Prepare line items for Stripe Checkout
    const line_items = productData.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: item.name },
        unit_amount: Math.floor(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Create Stripe Checkout Session

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${origin}/loader?next=my-orders`,
      cancel_url: `${origin}/cart`,
      line_items,
      metadata: {
        orderId: order._id.toString(),
        userId,
      },
    });

    console.log("Stripe session created:", session.id);
    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Error in placeOrderStripeSession:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Stripe Webhook Handler

export const stripeWebhooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!event?.type) return res.status(400).send("Invalid event");

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { orderId, userId } = session.metadata || {};

        if (orderId) {
          await Order.findByIdAndUpdate(orderId, { isPaid: true });
        }
        if (userId) {
          await User.findByIdAndUpdate(userId, { cartItems: {} });
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const sessionList = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
        });

        const session = sessionList.data[0];
        const { orderId } = session?.metadata || {};

        if (orderId) {
          await Order.findByIdAndDelete(orderId);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).send("Webhook processing failed.");
  }
};

// Get Orders by User ID : /api/order/user
export const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await Order.find({
      userId,
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get All Orders ( for seller / admin) : /api/order/seller
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
