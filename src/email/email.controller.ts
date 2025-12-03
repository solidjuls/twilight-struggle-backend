import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailService, SMTPConfig } from './email.service';
import { Public } from '../auth/decorators/auth.decorators';

interface TestEmailDto {
  to: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
}

interface SendEmailDto {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
}

@Controller('email')
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Public()
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(@Body() testEmailDto: TestEmailDto) {
    const smtpConfig: SMTPConfig = {
      host: testEmailDto.smtpHost,
      port: testEmailDto.smtpPort,
      secure: testEmailDto.smtpSecure,
      user: testEmailDto.smtpUser,
      password: testEmailDto.smtpPassword,
    };

    try {
      const success = await this.emailService.sendTestEmail(testEmailDto.to, smtpConfig);
      
      return {
        success,
        message: success 
          ? 'Test email sent successfully!' 
          : 'Failed to send test email. Please check your SMTP configuration.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error sending test email: ' + error.message,
      };
    }
  }

  @Public()
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    const smtpConfig: SMTPConfig = {
      host: sendEmailDto.smtpHost,
      port: sendEmailDto.smtpPort,
      secure: sendEmailDto.smtpSecure,
      user: sendEmailDto.smtpUser,
      password: sendEmailDto.smtpPassword,
    };

    try {
      const success = await this.emailService.sendEmail({
        to: sendEmailDto.to,
        subject: sendEmailDto.subject,
        html: sendEmailDto.html,
        text: sendEmailDto.text,
      }, smtpConfig);
      
      return {
        success,
        message: success 
          ? 'Email sent successfully!' 
          : 'Failed to send email. Please check your SMTP configuration.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error sending email: ' + error.message,
      };
    }
  }
}
