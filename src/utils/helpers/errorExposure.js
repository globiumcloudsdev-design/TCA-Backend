/**
 * Error detail exposure switch.
 *
 * Stack traces, internal paths and raw error messages are NEVER put in an API
 * response unless EXPOSE_ERROR_DETAILS=true is set explicitly. NODE_ENV is
 * deliberately ignored (Render runs with NODE_ENV=development). Full errors are
 * always logged server-side.
 */
export const exposeErrorDetails = () => process.env.EXPOSE_ERROR_DETAILS === 'true';

export default exposeErrorDetails;
