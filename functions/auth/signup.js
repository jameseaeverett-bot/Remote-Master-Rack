import { startAuthentication } from '../_lib/auth.js';

export const onRequestGet = (context) => startAuthentication(context, 'signup');
