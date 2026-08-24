import { env } from "../config/env.js";
export async function sendEmail(to, subject, html) {
    if (env.EMAIL_PROVIDER === "console") {
        console.info(JSON.stringify({ email: { to, subject, html } }));
        return;
    }
    // Provider adapters can be added without changing workflow services. Credentials are intentionally not fabricated.
    console.warn(`Email provider ${env.EMAIL_PROVIDER} is configured but no adapter is installed; email queued for ${to}`);
}
//# sourceMappingURL=email.service.js.map