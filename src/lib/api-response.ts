import { NextResponse } from "next/server";

type SuccessResponse<T> = {
  message?: string;
  data?: T;
  status?: number;
};

type ErrorResponse = {
  message: string;
  status?: number;
  errors?: unknown;
};

export function successResponse<T>({
  message = "Success",
  data,
  status = 200,
}: SuccessResponse<T>) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status },
  );
}

export function errorResponse({
  message,
  status = 500,
  errors,
}: ErrorResponse) {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
    },
    { status },
  );
}
