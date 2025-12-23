export class MissingCharacteristicsError extends Error {
  constructor() {
    super();
    this.name = 'MissingCharacteristicsError';
    this.message = 'BLE service does not contain all necessary characteristics';
  }
}
export class UnreadableVersionCharacteristicError extends Error {
  constructor() {
    super();
    this.name = 'UnreadableVersionCharacteristicError';
    this.message = `The version characteristic can't be read`;
  }
}
export class UnreadableReceiveCharacteristicError extends Error {
  constructor() {
    super();
    this.name = 'UnreadableReceiveCharacteristicError';
    this.message = `The receive characteristic can't be read`;
  }
}
export class UnwritableTransmitCharacteristicError extends Error {
  constructor() {
    super();
    this.name = 'UnwritableTransmitCharacteristicError';
    this.message = `The transmit characteristic can't be written to`;
  }
}
export class InvalidProtocolVersionError extends Error {
  constructor() {
    super();
    this.name = 'InvalidProtocolVersionError';
    this.message = 'The protocol version is not supported';
  }
}
export class UnknownError extends Error {
  constructor() {
    super();
    this.name = 'UnknownError';
    this.message = 'Something unexpected occured';
  }
}
export class ResourceIsBusyError extends Error {}
export class NotSupportedError extends Error {}
export class NotAllowedError extends Error {}
export class OperationCancelledError extends Error {}
export class OperationAbortedError extends Error {}
export class TimeoutError extends Error {}
export class NotFoundError extends Error {}
export class AlreadyExistsError extends Error {}
export class DataTooLargeError extends Error {}
export class LimitExceededError extends Error {}
export class InvalidStateError extends Error {}
export class IOError extends Error {}
export class FileError extends Error {}
export class NetworkError extends Error {}
export class ProtocolError extends Error {}
export class InternalError extends Error {}
export class MemoryAllocationError extends Error {}
export class InvalidArgumentError extends Error {}
export class InvalidDataFormatError extends Error {}
export class OutOfRangeError extends Error {}

export const resultToError = (result: number): void => {
  switch (result) {
    case 0:
      return;

    case -100:
      throw new UnknownError();

    case -110:
      throw new ResourceIsBusyError();

    case -120:
      throw new NotSupportedError();

    case -130:
      throw new NotAllowedError();

    case -140:
      throw new OperationCancelledError();

    case -150:
      throw new OperationAbortedError();

    case -160:
      throw new TimeoutError();

    case -170:
      throw new NotFoundError();

    case -180:
      throw new AlreadyExistsError();

    case -190:
      throw new DataTooLargeError();

    case -200:
      throw new LimitExceededError();

    case -210:
      throw new InvalidStateError();

    case -220:
      throw new IOError();

    case -225:
      throw new FileError();

    case -230:
      throw new NetworkError();

    case -240:
      throw new ProtocolError();

    case -250:
      throw new InternalError();

    case -260:
      throw new MemoryAllocationError();

    case -270:
      throw new InvalidArgumentError();

    case -280:
      throw new InvalidDataFormatError();

    case -290:
      throw new OutOfRangeError();

    default:
      throw new UnknownError();
  }
};
