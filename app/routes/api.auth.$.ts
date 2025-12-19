import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { signup, login, logout, getCurrentUser } from '~/lib/auth.server';
import { signupSchema, loginSchema } from '~/types/schemas';

/**
 * POST /api/auth/signup
 * POST /api/auth/login  
 * POST /api/auth/logout
 * GET /api/auth/me
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';

  if (path === 'me') {
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return Response.json({ user });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const path = params['*'] || '';

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    if (path === 'signup') {
      const body = await request.json();
      const data = signupSchema.parse(body);
      const { user, headers } = await signup(data);
      return Response.json({ user }, { headers });
    }

    if (path === 'login') {
      const body = await request.json();
      const data = loginSchema.parse(body);
      const { user, headers } = await login(data.email, data.password);
      return Response.json({ user }, { headers });
    }

    if (path === 'logout') {
      const headers = await logout(request);
      return Response.json({ success: true }, { headers });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

