import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth-utils';
import { z } from 'zod';

const resetSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
  password: z.string().min(6, 'Пароль должен быть минимум 6 символов'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetSchema.parse(body);

    const requestRow = await prisma.passwordResetRequest.findUnique({
      where: { token },
    });

    if (!requestRow || requestRow.expires < new Date()) {
      return NextResponse.json(
        { error: 'Ссылка недействительна или истекла. Запросите сброс пароля заново.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: requestRow.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден.' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetRequest.delete({
        where: { id: requestRow.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Пароль успешно изменён. Войдите с новым паролем.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Произошла ошибка. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
