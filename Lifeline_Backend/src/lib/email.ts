import { Client, SendEmailV3_1, type Contact, type LibraryResponse } from 'node-mailjet';
import * as fs from 'node:fs';

const mailjet = Client.apiConnect(process.env.MJ_APIKEY_PUBLIC as string, process.env.MJ_APIKEY_PRIVATE as string)
export async function sendVerifyEmail(email: string, url: string) {
    await ensureContact(email)

    const data: SendEmailV3_1.Body = {
        Messages: [
            {
                From: {
                    Email: "jullianq.dev+mailjet@gmail.com",
                    Name: "JullianQ"
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
    const exists = await isUser(email)

    if (!exists) {
        return await addContact(email)
    }

    return true
}

export async function addContact(email: string): Promise<boolean> {
    try {
        const res = await mailjet
            .post('contact')
            .request({
                Email: email
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
                    Email: "jullianq.dev+mailjet@gmail.com",
                    Name: "JullianQ"
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

        console.log('Magic link email sent successfully')
        console.log('Token:', token)
        console.log('URL:', url)
        return token
    } catch (error) {
        console.error('Error sending magic link email:', error)
        return false
    }
}

function setEmail(email: string) {

}

function getEmail() {

}

function htmlTemplate(url: string): string {
    let html = fs.readFileSync("./src/lib/email_template.html", "utf8")
    return html
        .replace(/\[\[verify_url\]\]/gm, url)
        .replace("{{LOGO_URL}}", "https://i.imgur.com/ZCrqLpj.png")
}
