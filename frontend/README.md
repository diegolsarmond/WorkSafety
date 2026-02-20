# WorkSafety Mobile App (Frontend)

## Overview
This is the mobile frontend for the WorkSafety application, built with React, Vite, and Tailwind CSS. It focuses on providing a secure and efficient interface for safety inspectors and managers.

## Features (Sprint 1)
- **Authentication**: Login, Forgot Password, Reset Password.
- **Session Management**: Secure token storage, "Keep me signed in", Auto-logout on expiry.
- **Dashboard**: Home screen with inspection status.
- **Admin**: Basic User Management (List/Search).

## Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Security**: Crypto-JS (for client-side storage encryption)

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env` (optional, defaults are provided in code for dev).
    ```bash
    cp .env.example .env
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Access at `http://localhost:3000` (or port assigned by AI Studio).

## Mock API
The application currently uses a mock implementation in `src/services/auth/authService.ts` and `src/services/user/userService.ts` when running in development mode (`import.meta.env.DEV`).

**Test Credentials:**
- **Email**: `user@worksafety.gov`
- **Password**: `password`

## Project Structure
- `src/app`: App configuration (Router).
- `src/features`: Feature-based modules (Auth, Dashboard, Admin).
- `src/services`: API clients and business logic services.
- `src/store`: Global state management (Zustand).
- `src/ui`: Reusable UI components and layouts.
- `src/utils`: Helper functions.

## Security
See `SECURITY.md` for details on security measures implemented.
