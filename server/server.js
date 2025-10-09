import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";

import connectDB from "./configs/db.js";
import connectCloudinary from "./configs/cloudinary.js";

// Routers
import userRouter from "./routes/userRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";

const app = express();
const port = process.env.PORT || 4000;

// Connect to DB and Cloudinary
await connectDB();
await connectCloudinary();

// Allowed origins (update as needed)
const allowedOrigins = [
  "http://localhost:5173", // Local dev
  "https://greencart-tawny.vercel.app", // Your deployed frontend
];

// Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ Proper CORS setup for cross-origin cookies
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allows cookies to be sent and received
}));

// Routes
app.get("/", (req, res) => res.send("API is Working"));

app.use("/api/user", userRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/address", addressRouter);
app.use("/api/order", orderRouter);

// Start server
app.listen(port, () => {
  console.log(`✅ Server is running at http://localhost:${port}`);
});
