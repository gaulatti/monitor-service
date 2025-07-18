import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  AutoIncrement,
  CreatedAt,
} from 'sequelize-typescript';
import { Device } from './device.model';

@Table({
  tableName: 'analytics',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
})
export class Analytics extends Model<Analytics> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id: number;

  @ForeignKey(() => Device)
  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
  })
  deviceToken: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
  })
  event: string;

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
  })
  timestamp: Date;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(64),
  })
  platform: string;

  @Column({
    type: DataType.JSON,
  })
  metadata: {
    postId?: string;
    relevance?: number;
    categories?: string[];
    count?: number;
    [key: string]: any;
  };

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  // Relationships
  @BelongsTo(() => Device, 'deviceToken')
  device: Device;
}
