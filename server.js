const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const mongoose = require("mongoose");
const { Schema } = mongoose;
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

// Database connection
mongoose
  .connect(process.env.MONGO_ADMIN_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Database connected successfully.");
  })
  .catch((err) => {
    console.error("DB Connection Error:", err);
  });

// Middleware
app.use(express.json({ limit: "10mb" })); // Handle large JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000", // Frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Order schema
const orderSchema = new Schema({
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  productId: { type: String, required: true, unique: true },
  productImage: { type: String, required: true },
  productDescription: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  userInformations: {
    usermail: { type: String, required: true },
    userid: { type: String, required: true },
  },
});

const Order = mongoose.model("Order", orderSchema);

// User schema
const userSchema = new Schema({
  fullname: { type: String },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// Utility to generate unique IDs
const generateUniqueId = () => `oS-${Date.now()}`;

// Routes

// Create order
app.post("/admin/create-order", async (req, res) => {
  try {
    const { productName, productPrice, quantity, productImage, productDescription, userInformations } = req.body;

    if (!userInformations || !userInformations.usermail || !userInformations.userid) {
      return res.status(400).send({ success: false, error: "User information is missing or invalid." });
    }

    const newOrder = new Order({
      productName,
      productPrice,
      quantity,
      productId: generateUniqueId(),
      productImage,
      productDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
      userInformations,
    });

    await newOrder.save();
    res.status(201).send({ success: true, data: newOrder });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Delete order
app.delete("/admin/delete-order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) {
      return res.status(404).send({ success: false, error: "Order not found." });
    }
    res.send({ success: true, message: `Order deleted: ${id}` });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Update order
app.put("/admin/update-order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedOrder = await Order.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedOrder) {
      return res.status(404).send({ success: false, error: "Order not found." });
    }
    res.send({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Get all orders
app.get("/admin/orders", async (req, res) => {
  try {
    const orders = await Order.find({});
    res.send({ success: true, data: orders });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Get user by ID
app.get("/getusersAdmin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send({ success: false, error: "User not found." });
    }
    res.send({ success: true, data: { email: user.email, fullname: user.fullname, id: user._id } });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// User signup
app.post("/account/signup", async (req, res) => {
  try {
    const { fullname, username, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ success: false, error: "Email and password are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ success: false, error: "Email is already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ fullname, username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });

    res.status(201).send({ success: true, data: { id: user._id, fullname, username, email, token } });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// User login
app.post("/account/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ success: false, error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send({ success: false, error: "Invalid login credentials." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send({ success: false, error: "Invalid login credentials." });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.status(200).send({ success: true, data: { id: user._id, email, token } });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Server listening
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
