<!DOCTYPE html>
<html>
<head>
    <style>
        .container { font-family: sans-serif; padding: 20px; color: #333; }
        .otp { font-size: 24px; font-weight: bold; color: #545cd8; letter-spacing: 2px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Email Verification</h2>
        <p>Your verification code for Phoenix Forms is:</p>
        <p class="otp">{{ $otp }}</p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this code, please ignore this email.</p>
    </div>
</body>
</html>
