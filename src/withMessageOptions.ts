import Reply from './Reply';
import MessageOptions from './MessageOptions';

type Options = Pick<StructuredSerializeOptions, 'transfer'>;

const withMessageOptions = (returnValue: unknown, options: Options) => {
  return new Reply(returnValue, new MessageOptions(options));
};

export default withMessageOptions;
