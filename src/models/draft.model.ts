import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  AutoIncrement,
} from 'sequelize-typescript';
import { Event } from './event.model';

@Table({
  tableName: 'drafts',
  timestamps: false,
  createdAt: 'created_at',
})
export class Draft extends Model<Draft> {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  id: number;

  @Column({
    type: DataType.STRING(36),
    allowNull: false,
    unique: true,
  })
  uuid: string;

  @ForeignKey(() => Event)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  event_id: number;

  @Column({
    type: DataType.TEXT,
  })
  content: string;

  @Column({
    type: DataType.STRING(128),
  })
  model_used: string;

  @Column({
    type: DataType.STRING(64),
  })
  created_by: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  created_at: Date;

  // Relationships
  @BelongsTo(() => Event)
  event: Event;
} 