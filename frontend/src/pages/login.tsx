import type { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import LoginForm from '@/components/LoginForm';
import nextI18NextConfig from '../../next-i18next.config';

export default function LoginPage() {
    return <LoginForm />;
}


export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common']))
        },
    };
};
