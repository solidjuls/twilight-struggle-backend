import { Controller, Post, Body, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { EmailService, SMTPConfig } from './email.service';
import { Public } from '../auth/decorators/auth.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayloadDto } from '../auth/dto/auth.dto';
import { TournamentsService } from '../tournaments/tournaments.service';

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

interface ReminderDto {
  gameCode: string;
  daysLeft: number;
  dueDate: string;
  usaEmail: string;
  ussrEmail: string;
  usaPlayerFullName: string;
  usaPlaydekName: string;
  ussrPlayerFullName: string;
  ussrPlaydekName: string;
  usaTimezone: string;
  ussrTimezone: string;
}

@Controller('email')
export class EmailController {
  constructor(
    private emailService: EmailService,
    private tournamentsService: TournamentsService,
  ) {}

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

  @Post('reminders')
  @HttpCode(HttpStatus.OK)
  async sendReminders(@Body() reminders: ReminderDto[], @CurrentUser() user: JwtPayloadDto) {
    const isAdmin = await this.tournamentsService.isUserAdminForTournament(
      user.role,
      user.id,
      359,
    );

    if (!isAdmin) {
      throw new HttpException(
        'You are not admin of this tournament',
        HttpStatus.FORBIDDEN,
      );
    }

    const smtpConfig: SMTPConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER_JUNTA || '',
      password: process.env.SMTP_PWD_JUNTA || '',
    };

    const results = [];

    const reminder = reminders[0];
    const destEmails = [reminder.usaEmail, reminder.ussrEmail].filter(Boolean);

    try {
      const success = await this.emailService.sendReminderEmail(
        destEmails,
        reminder.gameCode,
        reminder.daysLeft,
        reminder.dueDate,
        reminder.usaPlayerFullName,
        reminder.usaPlaydekName,
        reminder.usaTimezone,
        reminder.ussrPlayerFullName,
        reminder.ussrPlaydekName,
        reminder.ussrTimezone,
        smtpConfig,
      );

      results.push({
        gameCode: reminder.gameCode,
        success,
      });
    } catch (error) {
      results.push({
        gameCode: reminder.gameCode,
        success: false,
        error: error.message,
      });
    }

    return {
      success: true,
      total: reminders.length,
      results,
    };
  }
}
