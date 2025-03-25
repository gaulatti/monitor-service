export type TriggerRequest = {
  slug: string;
  context: string;
  origin: string;
};

export type TriggerResponse = {
  slug: string;
  status: string;
};
