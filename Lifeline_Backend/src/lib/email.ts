import { Client, SendEmailV3_1, type Contact, type LibraryResponse } from 'node-mailjet';
import * as fs from 'node:fs';

const inquiryEmail = "inquiry@lifeline-help.me";
const inquiryName = "Lifeline Inquiry";
const registrationEmail = "register@lifeline-help.me";
const registrationName = "Lifeline Registration";
const alertEmail = "alert@lifeline-help.me";
const alertName = "Lifeline Emergency Alert";
const mailjetContactListId = Number(process.env.MJ_CONTACT_LIST_ID ?? "10527712");

const mailjet = Client.apiConnect(process.env.MJ_APIKEY_PUBLIC as string, process.env.MJ_APIKEY_PRIVATE as string)

export function getFrontendLoginUrl(): string {
    if (process.env.NODE_ENV === "production") {
        return "https://lifeline-help.me/login";
    }

    return "http://localhost:5173/login";
}
export async function sendVerifyEmail(email: string, url: string) {
    await ensureContact(email)

    const data: SendEmailV3_1.Body = {
        Messages: [
            {
                From: {
                    Email: registrationEmail,
                    Name: registrationName
                },
                To: [
                    {
                        Email: email
                    }
                ],
                Subject: "Welcome to Lifeline — Please Verify Your Email",
                HTMLPart: htmlTemplate(url),
                TemplateLanguage: false,
            }
        ],
    }

    const res: LibraryResponse<SendEmailV3_1.Response> = await mailjet
        .post("send", { 'version': 'v3.1' })
        .request(data)

    return res
    // Email sent successfully
}

export async function isUser(email: string): Promise<boolean> {
    try {
        const res = await mailjet.get('contact').request() as LibraryResponse<Contact.GetContactResponse>
        return res.body.Data.some(contact => contact.Email === email)
    } catch (error) {
        console.error('Error checking contact:', error)
        return false
    }
}

export async function ensureContact(email: string): Promise<boolean> {
    return await addContact(email)
}

export async function addContact(email: string): Promise<boolean> {
    try {
        if (!mailjetContactListId || Number.isNaN(mailjetContactListId)) {
            console.error("Mailjet contact list ID is not configured.");
            return false;
        }

        const res = await mailjet
            .post('contactslist')
            .id(mailjetContactListId)
            .action('managecontact')
            .request({
                Email: email,
                Action: 'addforce'
            }) as LibraryResponse<unknown>

        // Check if response was successful (status 201 for created)
        const status = res.response?.status
        return status === 201 || status === 200
    } catch (error) {
        console.error('Error adding contact:', error)
        return false
    }
}

export async function sendMagicLinkEmail(email: string, url: string, token: string) {
    await ensureContact(email)

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img
                    alt="Lifeline logo"
                    height="164"
                    src="https://i.imgur.com/ZCrqLpj.png"
                    style="display:block;outline:none;border:none;text-decoration:none;margin:0 auto"
                    width="164" />
            </div>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 20px;">Magic Link Sign In</h1>
                <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
                    Click the button below to sign in to your Lifeline account.
                </p>
                <a href="${url}" 
                   style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; 
                          border-radius: 5px; display: inline-block; font-weight: bold;">
                    Sign In to Lifeline
                </a>
                <p style="color: #999; font-size: 14px; margin-top: 30px;">
                    This link will expire in 15 minutes. If you didn't request this, you can safely ignore this email.
                </p>
            </div>
        </div>
    `

    const data: SendEmailV3_1.Body = {
        Messages: [
            {
                From: {
                    Email: registrationEmail,
                    Name: registrationName
                },
                To: [
                    {
                        Email: email
                    }
                ],
                Subject: "Sign In to Lifeline — Magic Link",
                HTMLPart: htmlContent,
                TemplateLanguage: false,
            }
        ],
    }

    try {
        const res: LibraryResponse<SendEmailV3_1.Response> = await mailjet
            .post("send", { 'version': 'v3.1' })
            .request(data)

        // console.log('Magic link email sent successfully')
        // console.log('Token:', token)
        // console.log('URL:', url)
        return token
    } catch (error) {
        console.error('Error sending magic link email:', error)
        return false
    }
}

type EmergencyAlertEmailInput = {
    toEmail: string;
    toName?: string | null;
    emergencyUserName?: string | null;
    emergencyUserPhone?: string | null;
    formattedLocation?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    triggeredAt?: Date;
};

export async function sendEmergencyAlertEmail(input: EmergencyAlertEmailInput) {
    await ensureContact(input.toEmail);

    const triggeredAt = input.triggeredAt ?? new Date();
    const locationText = input.formattedLocation
        ? input.formattedLocation
        : (typeof input.latitude === "number" && typeof input.longitude === "number")
            ? `${input.latitude}, ${input.longitude}`
            : "Location unavailable";
    const mapUrl = (typeof input.latitude === "number" && typeof input.longitude === "number")
        ? `https://maps.google.com/?q=${input.latitude},${input.longitude}`
        : null;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img
                    alt="Lifeline logo"
                    height="164"
                    src="https://i.imgur.com/ZCrqLpj.png"
                    style="display:block;outline:none;border:none;text-decoration:none;margin:0 auto"
                    width="164" />
            </div>
            <div style="background-color: #fff4f4; padding: 24px; border-radius: 10px;">
                <h1 style="color: #b91c1c; margin-bottom: 12px;">Emergency SOS Activated</h1>
                <p style="color: #333; font-size: 16px; margin: 0 0 12px;">
                    ${input.emergencyUserName || "A Lifeline user"} has triggered an emergency SOS.
                </p>
                <p style="color: #333; font-size: 16px; margin: 0 0 12px;">
                    Phone: ${input.emergencyUserPhone || "Unavailable"}
                </p>
                <p style="color: #333; font-size: 16px; margin: 0 0 12px;">
                    Location: ${locationText}
                </p>
                ${mapUrl ? `
                <p style="margin: 0 0 12px;">
                    <a href="${mapUrl}" style="color: #2563eb;">View on map</a>
                </p>
                ` : ""}
                <p style="color: #666; font-size: 14px; margin-top: 16px;">
                    Triggered at: ${triggeredAt.toISOString()}
                </p>
            </div>
        </div>
    `;

    const data: SendEmailV3_1.Body = {
        Messages: [
            {
                From: {
                    Email: alertEmail,
                    Name: alertName
                },
                To: [
                    {
                        Email: input.toEmail,
                        Name: input.toName || undefined
                    }
                ],
                Subject: "Lifeline Emergency Alert",
                HTMLPart: htmlContent,
                TemplateLanguage: false,
            }
        ],
    };

    try {
        const res: LibraryResponse<SendEmailV3_1.Response> = await mailjet
            .post("send", { 'version': 'v3.1' })
            .request(data);

        return res;
    } catch (error) {
        console.error('Error sending emergency alert email:', error);
        return false;
    }
}

function htmlTemplate(url: string): string {
    let html = fs.readFileSync("./src/lib/email_template.html", "utf8")
    return html
        .replace(/\[\[verify_url\]\]/gm, url)
        .replace("{{LOGO_URL}}", "https://i.imgur.com/ZCrqLpj.png")
}
