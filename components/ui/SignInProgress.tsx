import { BrandedLoader } from "./BrandedLoader";

export function SignInProgress({ message }: { message: string }) {
  return <BrandedLoader message={message} />;
}
