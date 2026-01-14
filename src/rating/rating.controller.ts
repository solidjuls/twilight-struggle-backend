import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RatingService } from './rating.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import {
  GetPlayerRatingsQueryDto,
  PlayerRatingListResponse,
  PlayerRatingHistoryDto,
} from './dto/rating.dto';

@Controller('rating')
@UseGuards(JwtAuthGuard)
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get()
  @Public()
  async getPlayerRatings(
    @Query() query: GetPlayerRatingsQueryDto,
  ): Promise<PlayerRatingListResponse> {
    try {
      const {
        p = '1',
        pso = '100',
        page: newPage,
        playerFilter,
        countrySelected,
        playdeck,
        orderDirection = 'desc',
      } = query;

      // Parse parameters - support both legacy (p, pso) and new (page, pageSize) parameters
      const page = Number(newPage || p);
      const pageSize = Number(pso);
      const playerIds = playerFilter ? playerFilter.split(',').filter(id => id.trim()) : undefined;

      if (page < 1) {
        throw new HttpException('Page must be greater than 0', HttpStatus.BAD_REQUEST);
      }

      const result = await this.ratingService.getPlayerRatings({
        page,
        pageSize,
        playerIds,
        countryId: countrySelected,
        playdeckName: playdeck,
        orderDirection,
      });

      return result;
    } catch (error) {
      console.error('[Rating GET]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("history")
  @Public()
  async getRatingHistory(
    @Query() query: PlayerRatingHistoryDto,
  ): Promise<any> {
    try {
      const {
        userId,
        fromDate,
      } = query;

      if (!userId) {
        throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
      }

      const date = fromDate ? new Date(fromDate) : undefined;
      const result = await this.ratingService.getRatingHistory({
        userId,
        fromDate: date,
      });
      
      const serializedData = JSON.stringify(result, (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      });

      return serializedData;
    } catch (error) {
      console.error('[Rating GET]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @Public()
  getHealth() {
    return { status: 'Rating API is healthy', timestamp: new Date().toISOString() };
  }
}
