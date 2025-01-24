const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const app = express();
const port = process.env.PORT;
const mongoose = require("mongoose");
const { Schema } = mongoose;
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

// Database connection
mongoose
  .connect(process.env.MONGO_ADMIN_URL)
  .then(() => {
    console.log(
      `Database connected successfully with ${mongoose.connection.host}`
    );
  })
  .catch((err) => {
    console.log("DB CONNECTION ERROR", err);
  });
app.use(express.json({ limit: "10mb" })); // For JSON
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.json());
app.use(cors());
// Create schema for orders
const orderSchema = new Schema({
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  productId: { type: String, required: true, unique: true },
  productImage: { type: String, required: true, unique: false },
  productDescription: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  adminUserId: { type: String },
  adminEmail: { type: String },
});
const Order = mongoose.model("create-order-admin", orderSchema);

// Create schema for users
const userSchema = new Schema({
  Fullname: { type: String },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  userImage: {
    type: String,
    default:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaqiwrtc2R9MuIS83171xsgtTt81GddweP-g&s",
  },
});
const User = mongoose.model("signup", userSchema);

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000", // Frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Generate a unique ID
const generateUniqueId = () => {
  return `oS-${Date.now()}`;
};

// Routes

// Create order
app.post("/admin/create-order/", async (req, res) => {
  try {
    const createOrder = new Order({
      productName: req.body.productName,
      productPrice: req.body.productPrice,
      quantity: req.body.quantity,
      productId: generateUniqueId(),
      productImage: req.body.productImage,
      productDescription: req.body.productDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "" || "Pending",
      adminUserId: req.body.adminUserId,
      adminEmail: req.body.adminEmail,
    });
    await createOrder.save();
    res.status(201).send({ success: true, data: createOrder });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Remove order
app.delete("/admin/delete-order/:id", async (req, res) => {
  try {s
    const { id } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) {
      return res.status(404).send({ success: false, error: "Order not found" });
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
    const updatedOrder = await Order.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedOrder) {
      return res.status(404).send({ success: false, error: "Order not found" });
    }
    res.send({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Get all orders
// app.get("/", async (req, res) => {
//   try {
//     const orders = await Order.find({});
//     res.send({ success: true, data: orders });
//   } catch (error) {
//     res.status(500).send({ success: false, error: error.message });
//   }
// });

//signup
app.post("/account/signup", async (req, res) => {
  try {
    const { Fullname, username, email, password } = req.body;

    // Validate input fields
    if (!email || !password) {
      return res
        .status(400)
        .send({ success: false, error: "All fields are required." });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .send({ success: false, error: "Email already in use." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = new User({
      Fullname,
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate a JWT token (without sensitive data like password)
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Respond with the user data and token
    res.status(201).send({
      success: true,
      message: "Signup successful.",
      data: {
        id: user._id,
        token,
      },
    });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

app.get("/admin/users/orderlist/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .send({ success: false, error: "Admin user ID is required." });
  }

  try {
    const orderCount = await Order.countDocuments({ adminUserId: id });
    const orders = await Order.find({ adminUserId: id });
    res.send({ success: true, orderCreate: orderCount, data: orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res
      .status(500)
      .send({ success: false, error: "An internal server error occurred." });
  }
});

// get userinformation by id
app.get("/admin/user/information/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .send({ success: false, error: "User ID is required." });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send({ success: false, error: "User not found." });
    }

    res.send({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res
      .status(500)
      .send({ success: false, error: "An internal server error occurred." });
  }
});

// Login

app.post("/account/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .send({ success: false, error: "Email and password are required." });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid login credentials." });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid login credentials." });
    }
    // Generate a JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.status(200).send({
      success: true,
      message: "Login successful.",
      data: {
        token: token,
        id: user._id,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, error: "An error occurred. Please try again." });
  }
});

// 
// Forget password route
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER, // Your email
    pass: process.env.SMTP_PASS, // Your email password or app password
  },
});
transporter.verify((error, success) => {
  if (error) {
    console.error("Transporter verification failed:", error);
  } else {
    console.log("Transporter is ready to send emails:", success);
  }
});
app.post("/account/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .send({ success: false, error: "Email does not exist." });
    }

    // Generate a reset token (valid for 15 minutes)
    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "15m" });

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER, // Your email
        pass: process.env.SMTP_PASS, // Your email password or app password
      },
    });
    transporter.verify((error, success) => {
      if (error) {
        console.error("Transporter verification failed:", error);
      } else {
        console.log("Transporter is ready to send emails:", success);
      }
    });

    // Send reset link via email
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "Password Reset Request",
      html: `<p>Click the link below to reset your password:</p><a href="${resetLink}">Click This link</a>`,
    });
    console.log("Reset link sent to:", {email,resetLink});
    res.send({ success: true, message: "Password reset email sent." });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});
// Send password reset confirmation email
async function sendResetPasswordEmail(userEmail) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: userEmail,
    subject: "Password Reset Successful",
    text: "Your password has been successfully reset.",
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending reset password email:", error);
  }
}

// Reset password route
app.post("/account/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).send({ success: false, error: "Invalid token." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    user.password = hashedPassword;
    await user.save();
    await sendResetPasswordEmail(user.email);

    res.send({ success: true, message: "Password reset successful."  });
  } catch (error) {
    res.status(500).send({
      success: false,
      error: error.name === "TokenExpiredError" ? "Token expired." : error.message,
    });
  }
});


// admin user get informations
app.get("/getusersAdmin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orderCount = await Order.countDocuments({ adminUserId: id });
    const ordersList = await Order.find({ adminUserId: id });

    // Fetch the user from the database
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).send({
        success: false,
        error: "User not found.",
      });
    }

    res.send({
      success: true,
      data: {
        email: user.email,
        name: user.name,
        username: user.username,
        userImage: user.userImage,
        id: user._id,
      },
      orderList: orderCount,
      orders: ordersList,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      error: error.message,
    });
  }
});

// Server listening
app.listen(port, () => {
  console.log(`Server is up and listening on port ${port}`);
});
