import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/login',
      permanent: false, // 设置为 true 表示 301 永久重定向
    },
  };
};

export default function Home() {
  return null; // 永远不会渲染
}


