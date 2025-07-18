import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  AllowNull,
  Unique,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({
  tableName: 'devices',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
})
export class Device extends Model<Device> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id: number;

  @Unique
  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
  })
  deviceToken: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(64),
  })
  platform: string;

  @AllowNull(false)
  @Column({
    type: DataType.FLOAT,
    validate: {
      min: 0,
      max: 10,
    },
  })
  relevanceThreshold: number;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
  })
  deviceId: string;

  @Column({
    type: DataType.STRING(255),
  })
  model: string;

  @Column({
    type: DataType.STRING(255),
  })
  systemVersion: string;

  @Column({
    type: DataType.STRING(255),
  })
  appVersion: string;

  @Column({
    type: DataType.STRING(255),
  })
  buildNumber: string;

  @Column({
    type: DataType.STRING(255),
  })
  bundleId: string;

  @Column({
    type: DataType.STRING(255),
  })
  timeZone: string;

  @Column({
    type: DataType.STRING(255),
  })
  language: string;

  @Column({
    type: DataType.JSON,
  })
  categories: string[];

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  quietHours: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
  })
  registeredAt: Date;

  @Column({
    type: DataType.DATE,
  })
  lastUpdated: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  updatedAt: Date;
}
