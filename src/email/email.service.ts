import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Send email using provided SMTP configuration
   * @param emailOptions - Email content and recipients
   * @param smtpConfig - SMTP server configuration
   * @returns Promise<boolean> - Success status
   */
  async sendEmail(emailOptions: EmailOptions, smtpConfig: SMTPConfig): Promise<boolean> {
    try {
      // Create transporter with provided SMTP config
      const transporter: Transporter = nodemailer.createTransport({
        service: "gmail",
        port: smtpConfig.port,
        secure: smtpConfig.secure, // true for 465, false for other ports
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.password,
        },
        // Additional options for better compatibility
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
      });

      // Verify SMTP connection
      await transporter.verify();
      this.logger.log(`SMTP connection verified for ${smtpConfig.host}`);

      // Prepare email data
      const mailOptions = {
        from: `"Twilight Struggle" <${smtpConfig.user}>`,
        to: emailOptions.to.join(', '),
        subject: emailOptions.subject,
        text: emailOptions.text,
        html: emailOptions.html,
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      this.logger.log(`Email sent successfully to ${emailOptions.to.join(', ')}`);
      this.logger.log(`Message ID: ${info.messageId}`);
      
      return true;

    } catch (error) {
      this.logger.error(`Failed to send email to ${emailOptions.to.join(', ')}:`, error);
      return false;
    }
  }

  /**
   * Send verification email with pre-built template
   * @param email - Recipient email
   * @param name - Recipient name
   * @param verificationUrl - Verification link
   * @param smtpConfig - SMTP configuration
   * @returns Promise<boolean> - Success status
   */
  async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
    smtpConfig: SMTPConfig
  ): Promise<boolean> {
    const emailOptions: EmailOptions = {
      to: [email],
      subject: 'Verify Your Email Address - Twilight Struggle',
      html: this.generateVerificationEmailHTML(name, verificationUrl),
      text: this.generateVerificationEmailText(name, verificationUrl),
    };

    return this.sendEmail(emailOptions, smtpConfig);
  }

  /**
   * Generate HTML template for verification email
   */
  private generateVerificationEmailHTML(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: #3498db; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Twilight Struggle</h1>
            <h2>Email Verification</h2>
          </div>
          <div class="content">
            <h3>Hello ${name || 'User'}!</h3>
            <p>Thank you for registering with Twilight Struggle. To complete your registration and access your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3498db;">${verificationUrl}</p>
            
            <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
            
            <p>If you didn't create an account with Twilight Struggle, you can safely ignore this email.</p>
            
            <p>Welcome to the Twilight Struggle community!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Twilight Struggle. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text template for verification email
   */
  private generateVerificationEmailText(name: string, verificationUrl: string): string {
    return `
Hello ${name || 'User'}!

Thank you for registering with Twilight Struggle. To complete your registration and access your account, please verify your email address by visiting the following link:

${verificationUrl}

Important: This verification link will expire in 24 hours for security reasons.

If you didn't create an account with Twilight Struggle, you can safely ignore this email.

Welcome to the Twilight Struggle community!

---
© ${new Date().getFullYear()} Twilight Struggle. All rights reserved.
This is an automated email. Please do not reply to this message.
    `.trim();
  }

  /**
   * Test email functionality - sends a simple test email
   * @param to - Recipient email address
   * @param smtpConfig - SMTP configuration
   * @returns Promise<boolean> - Success status
   */
  async sendTestEmail(to: string, smtpConfig: SMTPConfig): Promise<boolean> {
    const emailOptions: EmailOptions = {
      to: [to],
      subject: 'Test Email from Twilight Struggle',
      html: `
        <h2>Email Service Test</h2>
        <p>This is a test email to verify that the email service is working correctly.</p>
        <p>If you received this email, the SMTP configuration is working properly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `
Email Service Test

This is a test email to verify that the email service is working correctly.
If you received this email, the SMTP configuration is working properly!

Sent at: ${new Date().toISOString()}
      `.trim(),
    };

    return this.sendEmail(emailOptions, smtpConfig);
  }
}
