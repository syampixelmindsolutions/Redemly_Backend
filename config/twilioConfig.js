import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = new twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);
// In twilioConfig.js or a new fast2smsConfig.js
export const SendSms = async (phone, message) => {
  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      'authorization': process.env.FAST2SMS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      route: 'otp',
      variables_values: message,
      numbers: phone.replace('+91', ''), // just 10 digit number
    })
  });
  
  const data = await response.json();
  if (!data.return) throw new Error(data.message);
  return data;
};



export const loginUser = async (req, res) => {
  const { phone } = req.body;
  console.log("🔍 Login requested for phone:", phone);

  try {
    const user = await User.findOne({ phone: phone.toString() });

    if (!user) {
      return res.status(200).json({
        isExists: false,
        message: "User not found. Please register first."
      });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // ✅ Try sending SMS but don't crash if it fails
    let smsSent = false;
    try {
      await SendSms(
        `+91${phone}`,
        `Your OTP is ${otp}. It is valid for 5 minutes.`
      );
      smsSent = true;
    } catch (smsError) {
      console.warn("⚠️ SMS not sent (Twilio trial limitation):", smsError.message);
    }

    return res.status(200).json({
      isExists: true,
      message: smsSent ? "OTP sent successfully" : "OTP generated (SMS failed - trial account)",
      otp,  // Always return OTP for testing
      userId: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      coins: user.coins,
    });

  } catch (err) {
    console.error("❌ Login OTP error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
