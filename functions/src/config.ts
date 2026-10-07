import { defineString } from 'firebase-functions/params';

export const REGION = 'us-central1';

export const correoPermitido = defineString('ALLOWED_EMAIL');
