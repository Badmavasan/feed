import axiosInstance from './axiosInstance';

// 获取当前登录用户信息
export const getCurrentUser = async () => {
    try {
        const res = await axiosInstance.get('/api/auth/me');
        return res.data;
    } catch (err) {
        console.error('[getCurrentUser error]', err);
        throw err;
    }
};

// 获取所有统计信息（任务类型、错误、练习、组件、反馈）绑定 projectId
export const getStatsCounts = async (projectId: number) => {
    try {
        const query = `?projectId=${projectId}`;

        const [types, erreurs, exercices, composants, feedbacks] = await Promise.all([
            axiosInstance.get(`/api/statistics/types/count${query}`),
            axiosInstance.get(`/api/statistics/erreurs/count${query}`),
            axiosInstance.get(`/api/statistics/exercices/count${query}`),
            axiosInstance.get(`/api/statistics/composants/count${query}`),
            axiosInstance.get(`/api/statistics/feedbacks/count${query}`),
        ]);

        return {
            totalTypes: types.data.total,
            totalErreurs: erreurs.data.total,
            totalExercises: exercices.data.total,
            totalComponents: composants.data.total,
            totalFeedbacks: feedbacks.data.total,
        };
    } catch (err) {
        console.error('[getStatsCounts error]', err);
        throw err;
    }
};
