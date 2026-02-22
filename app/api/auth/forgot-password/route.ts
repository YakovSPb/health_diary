import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

const forgotSchema = z.object({
  email: z.string().email('Неверный формат email'),
});

const RESET_TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Всегда возвращаем успех, чтобы не раскрывать наличие email в системе
    const baseUrl =
      request.headers.get('origin') ||
      request.nextUrl.origin;

    if (!user || !user.password) {
      // Пользователь с паролем не найден (или вход только через Google)
      return NextResponse.json({
        success: true,
        message: 'Если аккаунт с таким email существует, на него придёт ссылка для сброса пароля.',
        resetLink: null,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetRequest.deleteMany({
      where: { email: user.email },
    });

    await prisma.passwordResetRequest.create({
      data: {
        email: user.email,
        token,
        expires,
      },
    });

    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    return NextResponse.json({
      success: true,
      message: 'Ссылка для сброса пароля создана. Используйте её в течение 1 часа.',
      resetLink,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Произошла ошибка. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
