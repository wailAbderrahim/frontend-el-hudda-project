
const nodemailer = require('nodemailer')
require('dotenv').config()

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})

const getFrontendUrl = () => {
    const raw = (process.env.FRONTEND_URL || process.env.CLIENT_URL || '')
        .trim()
        .replace(/\/+$/, '')

    if (
        raw &&
        !raw.includes('localhost') &&
        !raw.includes('127.0.0.1') &&
        !raw.includes('onrender.com')
    ) {
        return raw
    }

    return 'https://el-hudda.vercel.app'
}

/**
 * Send Arabic verification email
 * Token validity: 15 minutes
 */
const sendVerificationEmail = async (email, token) => {
    const frontendUrl = getFrontendUrl()

    const verificationLink =
        `${frontendUrl}/pages/auth/verify-email.html` +
        `?token=${encodeURIComponent(token)}` +
        `&email=${encodeURIComponent(email)}`

    await transporter.sendMail({
        from: `"الهدى للقرآن" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'تأكيد البريد الإلكتروني | مدرسة الهدى للقرآن الكريم',
        html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">

    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            text-align: right;
            color: #1e293b;
        }

        .container {
            max-width: 580px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }

        .header {
            background: #047857;
            padding: 32px 24px;
            text-align: center;
            color: #ffffff;
        }

        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
        }

        .header p {
            margin: 8px 0 0;
            font-size: 13px;
            color: #a7f3d0;
        }

        .body {
            padding: 32px 28px;
            line-height: 1.8;
        }

        .greeting {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 16px;
        }

        .text {
            font-size: 14px;
            color: #475569;
            margin-bottom: 24px;
        }

        .btn-container {
            text-align: center;
            margin: 30px 0;
        }

        .btn {
            display: inline-block;
            background-color: #059669;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 36px;
            font-size: 15px;
            font-weight: 700;
            border-radius: 12px;
            box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
        }

        .notice {
            background-color: #f0fdf4;
            border-right: 4px solid #059669;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            color: #166534;
            margin-bottom: 24px;
        }

        .fallback {
            font-size: 12px;
            color: #64748b;
            word-break: break-all;
            margin-top: 20px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 16px;
        }

        .footer {
            background-color: #f1f5f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>

<body>

    <div class="container">

        <div class="header">
            <h1>مدرسة الهدى للقرآن الكريم</h1>
            <p>المسجد العامر — نظام إدارة المدرسة القرآنية</p>
        </div>

        <div class="body">

            <div class="greeting">
                السلام عليكم ورحمة الله وبركاته،
            </div>

            <p class="text">
                أهلاً ومرحباً بك في مدرسة الهدى للقرآن الكريم.
                لقد تم إنشاء حساب جديد مرتبط بهذا البريد الإلكتروني.
                لتأكيد حسابك وتفعيله، يرجى الضغط على الزر أدناه:
            </p>

            <div class="btn-container">
                <a
                    href="${verificationLink}"
                    class="btn"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    تأكيد البريد الإلكتروني
                </a>
            </div>

            <div class="notice">
                ⏱️
                <strong>ملاحظة:</strong>
                صلاحية هذا الرابط هي
                <strong>15 دقيقة</strong>
                فقط من وقت استلام هذه الرسالة.
            </div>

            <p
                class="text"
                style="font-size: 13px; color: #64748b;"
            >
                إذا لم تكن أنت من أنشأ هذا الحساب أو طلبت هذا الإجراء،
                يمكنك تجاهل هذه الرسالة بأمان دون اتخاذ أي خطوة.
            </p>

            <div class="fallback">
                إذا واجهت مشكلة في الضغط على الزر،
                يمكنك نسخ الرابط التالي ولصقه في المتصفح:
                <br><br>

                <a
                    href="${verificationLink}"
                    style="color: #059669;"
                >
                    ${verificationLink}
                </a>
            </div>

        </div>

        <div class="footer">
            © 2026 مدرسة الهدى للقرآن الكريم — جميع الحقوق محفوظة
        </div>

    </div>

</body>
</html>
        `
    })
}

/**
 * Send Arabic password reset email
 * Token validity: 15 minutes
 */
const sendResetPasswordEmail = async (email, token) => {
    const frontendUrl = getFrontendUrl()

    const resetLink =
        `${frontendUrl}/pages/auth/reset-password.html` +
        `?token=${encodeURIComponent(token)}`

    await transporter.sendMail({
        from: `"الهدى للقرآن" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'إعادة تعيين كلمة المرور | مدرسة الهدى للقرآن الكريم',
        html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">

<head>
    <meta charset="UTF-8">

    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            text-align: right;
            color: #1e293b;
        }

        .container {
            max-width: 580px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }

        .header {
            background: #047857;
            padding: 32px 24px;
            text-align: center;
            color: #ffffff;
        }

        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
        }

        .body {
            padding: 32px 28px;
            line-height: 1.8;
        }

        .greeting {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 16px;
        }

        .text {
            font-size: 14px;
            color: #475569;
            margin-bottom: 24px;
        }

        .btn-container {
            text-align: center;
            margin: 30px 0;
        }

        .btn {
            display: inline-block;
            background-color: #059669;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 36px;
            font-size: 15px;
            font-weight: 700;
            border-radius: 12px;
            box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
        }

        .notice {
            background-color: #fef2f2;
            border-right: 4px solid #ef4444;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            color: #991b1b;
            margin-bottom: 24px;
        }

        .footer {
            background-color: #f1f5f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>

<body>

    <div class="container">

        <div class="header">
            <h1>مدرسة الهدى للقرآن الكريم</h1>
        </div>

        <div class="body">

            <div class="greeting">
                السلام عليكم ورحمة الله وبركاته،
            </div>

            <p class="text">
                لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك
                في مدرسة الهدى.
                يمكنك تعيين كلمة مرور جديدة من خلال الضغط على الزر أدناه:
            </p>

            <div class="btn-container">
                <a
                    href="${resetLink}"
                    class="btn"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    إعادة تعيين كلمة المرور
                </a>
            </div>

            <div class="notice">
                ⏱️
                <strong>تنبيه أمان:</strong>
                صلاحية هذا الرابط هي
                <strong>15 دقيقة</strong>
                فقط.
            </div>

            <p
                class="text"
                style="font-size: 13px; color: #64748b;"
            >
                إذا لم تكن قد طلبت إعادة تعيين كلمة المرور،
                يرجى تجاهل هذه الرسالة،
                فستبقى كلمة المرور الحالية آمنة كما هي.
            </p>

        </div>

        <div class="footer">
            © 2026 مدرسة الهدى للقرآن الكريم — جميع الحقوق محفوظة
        </div>

    </div>

</body>
</html>
        `
    })
}

module.exports = {
    sendVerificationEmail,
    sendResetPasswordEmail,
    transporter
}

