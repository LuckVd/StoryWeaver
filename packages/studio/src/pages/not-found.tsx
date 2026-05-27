import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <h1 className="text-4xl font-bold">404</h1>
      <p>页面不存在</p>
      <Link to="/">
        <Button variant="outline">返回首页</Button>
      </Link>
    </div>
  );
}
