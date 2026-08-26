<?php

namespace App\Http\Controllers;

use App\Models\EmailVerification;
use App\Mail\OTPMailable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class OTPController extends Controller
{
    public function sendOTP(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $email = $request->email;
        $otp = rand(100000, 999999);
        $expiresAt = Carbon::now()->addMinutes(10);

        EmailVerification::updateOrCreate(
            ['email' => $email],
            [
                'otp' => $otp,
                'expires_at' => $expiresAt,
                'is_verified' => false
            ]
        );

        try {
            Mail::to($email)->send(new OTPMailable($otp));
            return response()->json(['message' => 'OTP sent successfully to your email.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to send email. ' . $e->getMessage()], 500);
        }
    }

    public function verifyOTP(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string|size:6'
        ]);

        $verification = EmailVerification::where('email', $request->email)
            ->where('otp', $request->otp)
            ->where('expires_at', '>', Carbon::now())
            ->first();

        if (!$verification) {
            return response()->json(['message' => 'Invalid or expired OTP.'], 400);
        }

        $verification->update(['is_verified' => true]);

        return response()->json(['message' => 'Email verified successfully!']);
    }
}
