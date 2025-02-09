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
const axios = require('axios');
const Status_product = 'Pending'; 

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
  Status: {
    type: String,
    enum: ["Pending", "Completed"],
    default: "Pending",
  },

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
    origin: `${process.env.Frontend_URL}`, // Frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Generate a unique ID
const generateUniqueId = () => {
  return `oS-${Date.now()}`;
};

//transporter
// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify Transporter
transporter.verify((error, success) => {
  if (error) {
    console.error("Transporter verification failed:", error);
  } else {
    console.log("Transporter is ready to send emails:", success);
  }
});

// Create Order
app.post("/admin/create-order/", async (req, res) => {
  try {
    const {
      productName,
      productPrice,
      quantity,
      productImage,
      productDescription,
      adminUserId,
      adminEmail,
    } = req.body;

    // Validate required fields
    if (!productName || !productPrice || !quantity || !adminEmail) {
      return res.status(400).send({
        success: false,
        message: "Missing required fields",
      });
    }

    // Create new order
    const newOrder = new Order({
      productName,
      productPrice,
      quantity,
      productId: generateUniqueId(),
      productImage,
      productDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
      adminUserId,
      adminEmail,
      Status: 'Pending', // Explicitly setting the status
    });

    // Save order to the database
    await newOrder.save();

    // Send email notification
    await sendOrderConfirmationEmail(newOrder, adminEmail);

    // Respond with success
    res.status(201).send({ success: true, data: newOrder });

  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});

// Function to send order confirmation email
async function sendOrderConfirmationEmail(order, adminEmail) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: [adminEmail, "abubakkarsajid4@gmail.com"],
      subject: "Order Confirmation - Your Order Details",
      html: generateEmailTemplate(order),
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

// Function to generate email template
function generateEmailTemplate(order) {
  return `
    <div style="max-width: 600px; margin: 20px auto; padding: 20px; background: linear-gradient(to bottom right, #f0fdf4, #d1fae5); border-radius: 20px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); font-family: Arial, sans-serif; color: #1f2937;">
      <h1 style="font-size: 24px; color: #047857; text-align: center; margin-bottom: 20px;">🎉 Order Confirmation</h1>
      <p style="font-size: 16px; text-align: center; color: #4b5563;">Thank you for your purchase! Here are the details of your order:</p>

      <img src="${order.productImage}" alt="Product Image" style="display: block; margin: 20px auto; border-radius: 10px; max-width: 100%; height: auto;">

      <div style="margin-top: 20px; padding: 20px; background-color: #ffffff; border-radius: 15px; border: 1px solid #e5e7eb;">
        <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #111827;">Order Summary</h3>

        <p><strong style="color: #6b7280;">Order ID:</strong> <span style="color: #111827;">${order._id}</span></p>
        <p><strong style="color: #6b7280;">Product Name:</strong> <span style="color: #111827;">${order.productName}</span></p>
        <p><strong style="color: #6b7280;">Product Price:</strong> <span style="color: #111827;">$${order.productPrice}</span></p>
        <p><strong style="color: #6b7280;">Created At:</strong> <span style="color: #111827;">${order.createdAt.toLocaleString()}</span></p>
        <p><strong style="color: #6b7280;">Status:</strong> 
          <span style="
            display: inline-block; 
            padding: 5px 12px; 
            border-radius: 9999px; 
            font-size: 14px; 
            font-weight: 600; 
            ${order.status === 'Completed' 
              ? 'background-color: #d1fae5; color: #047857;' 
              : 'background-color: #fef9c3; color: #b45309;'
            }">
            ${order.status || 'Pending'}
          </span>
        </p>
      </div>

      <p style="margin-top: 20px; font-size: 14px; text-align: center; color: #6b7280;">
        If you have any questions about your order, feel free to contact us at 
        <a href="mailto:support@example.com" style="color: #10b981; text-decoration: none;">support@example.com</a>.
      </p>
    </div>
  `;
}


// Remove order
app.delete("/admin/delete-order", async (req, res) => {
  try {
    const { id } = req.body;

    // Validate the ID (optional for MongoDB ObjectId)
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid ID format" });
    }

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
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: [user.email,"abubakkarsajid4@gmail.com"],
      subject: "🎉 Your Account Has Been Created Successfully!",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #4f46e5; color: #ffffff; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Welcome to Our Community!</h1>
            </div>
            <div style="padding: 30px; color: #333333;">
              <p style="font-size: 18px; margin-bottom: 20px;">
                🎉 <strong>Your account has been created successfully!</strong> 🎉
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Hello <strong>${user.Fullname}</strong>,<br>
                We're thrilled to have you here. Here are your account details:
              </p>
              <ul style="list-style: none; padding: 0; font-size: 16px; margin: 20px 0;">
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Full Name:</strong> ${user.Fullname}</li>
                <li><strong>Email:</strong> ${user.email}</li>
              </ul>
              <p style="font-size: 16px;">
                If you encounter any issues, feel free to reach out to us anytime.
              </p>
              <a href="https://wa.me/+923254472055" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px;">
                📞 Contact Us
              </a>
            </div>
            <div style="background-color: #f4f4f7; padding: 15px; text-align: center; color: #888888; font-size: 14px;">
              If you didn't create an account, please ignore this email.
            </div>
          </div>
        </div>
      `,
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

    // Generate JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Get client's IP address
    const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Fetch location data based on IP address
    let locationInfo = "Unknown Location";
    try {
      const response = await axios.get(`http://ip-api.com/json/${clientIP}`);
      const { countryCode, regionName, country } = response.data;
      locationInfo = `${city}, ${regionName}, ${countryCode},${country}`;
    } catch (locationError) {
      console.error("Error fetching location data:", locationError);
    }

    // Send Login Notification Email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: [user.email,"abubakkarsajid4@gmail.com"],
      subject: "🔒 New Login Detected on Your Account",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #4f46e5; color: #ffffff; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Login Alert</h1>
            </div>
            <div style="padding: 30px; color: #333333;">
              <p style="font-size: 18px; margin-bottom: 20px;">
                Hello <strong>${user.Fullname}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                We noticed a login to your account from the following details:
              </p>
              <ul style="list-style: none; padding: 0; font-size: 16px; margin: 20px 0;">
               
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>IP Address:</strong> ${clientIP}</li>
                <li><strong>Location:</strong> ${locationInfo}</li>
              </ul>
              <p style="font-size: 16px;">
                If this was not you, please secure your account immediately by changing your password.
              </p>
              <a href="https://wa.me/+923254472055" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px;">
                📞 Contact Support
              </a>
            </div>
            <div style="background-color: #f4f4f7; padding: 15px; text-align: center; color: #888888; font-size: 14px;">
              If you recognize this activity, no further action is needed.
            </div>
          </div>
        </div>
      `,
    });

    // Send successful login response
    return res.status(200).send({
      success: true,
      message: "Login successful.",
      data: {
        token: token,
        id: user._id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .send({ success: false, error: "An error occurred. Please try again." });
  }
});

// Forget password route


app.post("/account/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ success: false, error: "Email does not exist." });
    }

    // Generate a reset token (valid for 15 minutes)
    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "15m" });

    // Get client's IP address
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("Client IP:", clientIP);

    // Fetch location data based on IP address
    let locationInfo = "Unknown Location";
    if (clientIP === '::1' || clientIP === '127.0.0.1') {
      locationInfo = "Localhost (Development)";
    } else {
      try {
        const response = await axios.get(`http://ip-api.com/json/${clientIP}`);
        console.log("Location API Response:", response.data);

        if (response.data.status === "success") {
          const { city, regionName, country } = response.data;
          locationInfo = `${city || "Unknown City"}, ${regionName || "Unknown Region"}, ${country || "Unknown Country"}`;
        } else {
          console.warn("IP Geolocation failed:", response.data.message);
        }
      } catch (locationError) {
        console.error("Error fetching location data:", locationError);
      }
    }

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    transporter.verify((error, success) => {
      if (error) {
        console.error("Transporter verification failed:", error);
      } else {
        console.log("Transporter is ready to send emails:", success);
      }
    });

    // Prepare the reset link
    const resetLink = `${process.env.Frontend_URL}/reset-password/${resetToken}`;

    // Send reset email with IP and location details
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: [email, "abubakkarsajid4@gmail.com"],
      subject: "🔑 Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #4f46e5; color: #ffffff; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
            </div>
            <div style="padding: 30px; color: #333333;">
              <p style="font-size: 18px; margin-bottom: 20px;">
                Hello <strong>${user.FullName}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                We received a request to reset your password. If this was you, click the link below to proceed:
              </p>
              <a href="${resetLink}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px;">
                🔑 Reset Your Password
              </a>
              <p style="margin-top: 20px; font-size: 16px;">
                <strong>Account Details:</strong>
              </p>
              <ul style="list-style: none; padding: 0; font-size: 16px; margin: 10px 0;">
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>IP Address:</strong> ${clientIP}</li>
                <li><strong>Location:</strong> ${locationInfo}</li>
              </ul>
              <p style="font-size: 16px;">
                If you did not request this, please ignore this email or contact support.
              </p>
              <a href="https://wa.me/+923254472055" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px;">
                📞 Contact Support
              </a>
            </div>
            <div style="background-color: #f4f4f7; padding: 15px; text-align: center; color: #888888; font-size: 14px;">
              This link will expire in 15 minutes for your security.
            </div>
          </div>
        </div>
      `,
    });

    console.log("Reset link sent to:", { email, resetLink });
    res.send({ success: true, message: "Password reset email sent." });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});
// Send password reset confirmation email
// async function sendResetPasswordEmail(userEmail) {
//   const mailOptions = {
//     from: process.env.SMTP_USER,
//     to: userEmail,
//     subject: "Password Reset Successful",
//     html: `Your password has been successfully reset. <br> If any Problem  <h1>Contact us : <a href ="https://wa.me/+923254472055/">Whatsapp </a></h1> `,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log(`Password reset email sent to this E-Mail :-: ${userEmail}`);
//   } catch (error) {
//     console.error("Error sending reset password email:", error);
//   }
// }

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

    // Get client's IP address
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Fetch location data based on IP address
    let locationInfo = "Unknown Location";
    try {
      const response = await axios.get(`http://ip-api.com/json/${clientIP}`);
      const { city, regionName, country } = response.data;
      locationInfo = `${city}, ${regionName}, ${country}`;
    } catch (locationError) {
      console.error("Error fetching location data:", locationError);
    }

    // Send confirmation email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "🔒 Your Password Was Successfully Reset",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #4f46e5; color: #ffffff; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Password Reset Confirmation</h1>
            </div>
            <div style="padding: 30px; color: #333333;">
              <p style="font-size: 18px; margin-bottom: 20px;">
                Hello <strong>${user.FullName}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Your password has been successfully reset. If you performed this action, no further steps are required.
              </p>
              <p style="margin-top: 20px; font-size: 16px;">
                <strong>Reset Details:</strong>
              </p>
              <ul style="list-style: none; padding: 0; font-size: 16px; margin: 10px 0;">
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Full Name:</strong> ${user.FullName}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>IP Address:</strong> ${clientIP}</li>
                <li><strong>Location:</strong> ${locationInfo}</li>
              </ul>
              <p style="font-size: 16px;">
                If you did not request this password reset, please secure your account immediately by changing your password and contacting support.
              </p>
              <a href="https://wa.me/+923254472055" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px;">
                📞 Contact Support
              </a>
            </div>
            <div style="background-color: #f4f4f7; padding: 15px; text-align: center; color: #888888; font-size: 14px;">
              If this wasn't you, please take immediate action.
            </div>
          </div>
        </div>
      `,
    });

    // Respond with success
    res.send({ success: true, message: "Password reset successful." });

  } catch (error) {
    console.error("Reset Password Error:", error);
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



// update user information 
app.get('/user-profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    res.json(user);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Update user profile by ID
app.put('/user-profile/:id', async (req, res) => {
  try {
    const { Fullname, username, email, password, userImage } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        Fullname,
        username,
        email,
        password,
        userImage,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedUser) return res.status(404).send('User not found');
    res.json(updatedUser);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Server listening
app.listen(port, () => {
  console.log(`Server is up and listening on port ${port}`);
});
